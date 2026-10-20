(() => {
"use strict";
const D = window.TATRY, O = D.osm;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, " ").trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem("tatry:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("tatry:" + k, JSON.stringify(v)); } catch (e) { } }
};
const rad = Math.PI / 180;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
function dist(a, b, c, d) { const x = (d - b) * rad * Math.cos((a + c) / 2 * rad), y = (c - a) * rad; return Math.hypot(x, y) * 6371000; }
function distToLine(lat, lon, g) {
  const kx = Math.cos(lat * rad) * 111320, ky = 110540; let m = Infinity;
  for (let i = 0; i < g.length - 1; i++) {
    const ax = (g[i][1] - lon) * kx, ay = (g[i][0] - lat) * ky, bx = (g[i + 1][1] - lon) * kx, by = (g[i + 1][0] - lat) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L));
    m = Math.min(m, Math.hypot(ax + t * dx, ay + t * dy));
  }
  if (g.length === 1) m = dist(lat, lon, g[0][0], g[0][1]);
  return m;
}
function pip(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DIRPL = { N: "na pn.", NE: "na pn.-wsch.", E: "na wsch.", SE: "na pd.-wsch.", S: "na pd.", SW: "na pd.-zach.", W: "na zach.", NW: "na pn.-zach." };
function bearing(a, b, c, d) { const y = (c - a), x = (d - b) * Math.cos(a * rad); const deg = (Math.atan2(x, y) / rad + 360) % 360; return DIRS[Math.round(deg / 45) % 8]; }
const fmtKm = m => m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(1).replace(".", ",") + " km";

/* ---------- Polish side polygon (from border chain) ---------- */
const PROF = D.profile || [];
const PLRING = PROF.length ? [[49.42, 19.40], ...PROF.map(p => [p[2], p[3]]), [49.45, 20.16], [49.9, 20.16], [49.9, 19.40]] : null;
const isPL = (lat, lon) => PLRING ? pip(lat, lon, PLRING) : lat > 49.2;
const BPTS = PROF.filter((p, i) => i % 2 === 0);
function borderDist(lat, lon) { let m = Infinity; for (const p of BPTS) { const d = dist(lat, lon, p[2], p[3]); if (d < m) m = d; } return m; }

/* ---------- Features ---------- */
const KIND = {
  peak: "szczyt", saddle: "przełęcz", valley: "dolina", kociol: "kocioł", zleb: "żleb", lake: "staw", stream: "potok",
  hut: "schronisko", cave: "jaskinia", town: "miejscowość", locality: "miejsce / polana", ridge: "grzbiet / grań", rescue: "ratownictwo",
  waterfall: "wodospad", aerial: "kolej linowa", topr: "miejsce akcji"
};
const FE = [];
function merc(lat, lon) { const s = Math.sin(lat * rad); return [(lon + 180) / 360 * 256, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256]; }
function add(o) {
  o.id = FE.length; o.n = norm(o.name); o.na = norm(o.alt); o.hot = 0;
  o.w = merc(o.lat, o.lon);
  if (o.geom) o.gw = o.geom.map(p => merc(p[0], p[1]));
  o.pl = isPL(o.lat, o.lon);
  FE.push(o); return o;
}
function mid(g) { return g[Math.floor(g.length / 2)]; }
function ringArea(g) { let a = 0; for (let i = 0; i < g.length - 1; i++) a += (g[i][1] * g[i + 1][0] - g[i + 1][1] * g[i][0]); return Math.abs(a / 2) * 111320 * 72800; }
O.peak.forEach(p => add({ k: "peak", name: p[0], alt: p[1], lat: p[2], lon: p[3], ele: p[4], prio: p[4] ? p[4] / 42 : 18 }));
O.saddle.forEach(p => add({ k: "saddle", name: p[0], alt: p[1], lat: p[2], lon: p[3], ele: p[4], prio: (p[4] ? p[4] / 55 : 14) + (/przeł|sedlo/i.test(p[0]) ? 8 : 0) }));
O.valley.forEach(v => {
  const g = v[3]; if (!g.length) return; const m = mid(g);
  const sub = v[2] === "z" ? "zleb" : v[2] === "k" ? "kociol" : "valley";
  const main = /^dolin/i.test(v[0]) || /dolina$/i.test(v[0]);
  add({ k: sub, name: v[0], alt: v[1], lat: m[0], lon: m[1], geom: g, prio: sub === "valley" ? (main ? 52 : 36) : sub === "kociol" ? 28 : 22 });
});
O.lake.forEach(l => {
  const g = l[3]; if (!g.length || !l[0]) return;
  let la = 0, lo = 0; g.forEach(p => { la += p[0]; lo += p[1]; });
  const area = ringArea(g);
  add({ k: "lake", name: l[0], alt: l[1], ele: l[2], lat: la / g.length, lon: lo / g.length, geom: g, area, prio: 20 + Math.min(45, Math.sqrt(area) / 9) });
});
O.stream.forEach(s => { const g = s[3]; if (!g.length) return; const m = mid(g); add({ k: "stream", name: s[0], alt: s[1], lat: m[0], lon: m[1], geom: g, river: s[2], prio: s[2] ? 34 : 14 }); });
O.hut.forEach(h => add({ k: "hut", name: h[0], alt: h[1], lat: h[2], lon: h[3], ele: h[4], prio: h[5] ? 66 : 26, staffed: h[5] }));
O.cave.forEach(c => c[0] && add({ k: "cave", name: c[0], alt: c[1], lat: c[2], lon: c[3], ele: c[4], prio: 9 }));
O.town.forEach(t => add({ k: "town", name: t[0], alt: t[1], lat: t[2], lon: t[3], prio: t[4] ? 95 : 58 }));
O.locality.forEach(t => add({ k: "locality", name: t[0], alt: t[1], lat: t[2], lon: t[3], prio: /polana|hala/i.test(t[0]) ? 30 : 12 }));
O.ridge.forEach(r => { const g = r[2]; if (!g.length) return; const m = mid(g); add({ k: "ridge", name: r[0], alt: r[1], lat: m[0], lon: m[1], geom: g, prio: 30 }); });
O.rescue.forEach(r => add({ k: "rescue", name: r[0], alt: r[1], lat: r[2], lon: r[3], prio: 70 }));
(O.waterfall || []).forEach(r => add({ k: "waterfall", name: r[0], alt: r[1], lat: r[2], lon: r[3], prio: 24 }));

/* key objects for the Polish exam: boosted label priority */
const KEYNAMES = ["Giewont","Kasprowy Wierch","Kopa Kondracka","Małołączniak","Krzesanica","Ciemniak","Kominiarski Wierch","Ornak","Starorobociański Wierch","Wołowiec","Rakoń","Grześ","Bobrowiec","Trzydniowiański Wierch","Kończysty Wierch","Jarząbczy Wierch","Błyszcz","Bystra","Świnica","Kościelec","Kozi Wierch","Zadni Granat","Skrajny Granat","Krzyżne","Zawrat","Kozia Przełęcz","Rysy","Mięguszowiecki Szczyt Wielki","Szpiglasowy Wierch","Szpiglasowa Przełęcz","Wołoszyn","Gęsia Szyja","Nosal","Sarnia Skała","Morskie Oko","Czarny Staw pod Rysami","Wielki Staw Polski","Czarny Staw Polski","Przedni Staw Polski","Czarny Staw Gąsienicowy","Zmarzły Staw Gąsienicowy","Smreczyński Staw","Hala Gąsienicowa","Polana Chochołowska","Hala Ornak","Kalatówki","Hala Kondratowa","Polana Rusinowa","Łysa Polana","Palenica Białczańska","Wodogrzmoty Mickiewicza","Siklawa","Przełęcz Liliowe","Liliowe","Przełęcz Kondracka","Przełęcz pod Kopą Kondracką","Tomanowa Przełęcz","Iwaniacka Przełęcz","Siwa Przełęcz","Przełęcz między Kopami","Karb","Mnich","Miedziane","Opalony Wierch","Gerlach","Łomnica","Lodowy Szczyt","Krywań","Hawrań","Płaczliwa Skała","Wysoka","Żabi Koń","Cubryna","Granaty","Czerwone Wierchy","Beskid","Goryczkowa Czuba","Suchy Wierch Kondracki","Sucha Przełęcz","Kopa Magury","Skupniów Upłaz","Wielka Turnia","Mięguszowiecka Przełęcz pod Chłopkiem","Polski Grzebień","Baranie Rogi","Lodowa Przełęcz","Kołowy Szczyt","Jagnięcy Szczyt","Szeroka Jaworzyńska","Świstówka Roztocka","Buczynowe Turnie","Orla Baszta","Żółta Turnia","Kopa Królowa"];
const KEYSET = new Set(KEYNAMES.map(norm));
for (const f of FE) if (KEYSET.has(f.n) && (f.k !== "stream")) f.prio = Math.max(f.prio, f.k === "peak" ? 68 : 62) + (f.pl ? 6 : 0);
const TRAILS = O.trail.map(t => ({ c: t[0], g: t[1], gw: t[1].map(p => merc(p[0], p[1])) }));
const AERIAL = (O.aerial || []).map(a => ({ name: a[0], type: a[1], gw: a[2].map(p => merc(p[0], p[1])) }));
const BORDER = O.border.map(g => g.map(p => merc(p[0], p[1])));

/* ---------- Knowledge base linking ---------- */
const KB = D.kb || {};
const KBKIND = { "dolina": ["valley", "kociol"], "kocioł": ["kociol", "valley"], "żleb": ["zleb", "valley"], "polana": ["locality", "town"], "szczyt": ["peak"], "turnia": ["peak"], "przełęcz": ["saddle"], "grań": ["ridge", "peak"], "schronisko": ["hut", "rescue"] };
const tokset = s => norm(s).split(" ").filter(Boolean).sort().join(" ");
function linkKB(item, kind, group) {
  item.group = group;
  const raw = [item.name, item.name_sk];
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(item.name || "");
  if (m) raw.push(m[1], m[2]);
  const vars = new Set(raw.filter(Boolean).map(tokset));
  const kinds = KBKIND[kind] || [];
  let best = null, bd = Infinity;
  for (const f of FE) {
    if (!vars.has(tokset(f.name)) && !(f.alt && vars.has(tokset(f.alt)))) continue;
    let d = item.lat ? (f.geom ? distToLine(item.lat, item.lon, f.geom) : dist(item.lat, item.lon, f.lat, f.lon)) : 0;
    if (kinds.length && !kinds.includes(f.k)) d += 3000;
    if (d < bd) { bd = d; best = f; }
  }
  if ((!best || bd >= 4500) && item.lat && kinds.length) {
    // nearest object of the same kind (huts, polany); names often differ in form
    const lim = group === "huts" ? 700 : 350;
    for (const f of FE) { if (!kinds.includes(f.k) || f.kb) continue; const d = dist(item.lat, item.lon, f.lat, f.lon); if (d < lim && d < bd) { bd = d; best = f; } }
    if (best && bd >= lim) best = null;
  }
  if (best && bd < 4500 && !best.kb) { best.kb = item; item.f = best; best.prio = Math.max(best.prio, 60) + 15; return; }
  if (item.lat && item.lon) {
    const k = group === "huts" ? "hut" : (kinds[0] === "peak" || kinds[0] === "saddle") ? kinds[0] : "locality";
    const f = add({ k, name: (m ? m[1] : item.name), alt: item.name_sk || "", lat: +item.lat, lon: +item.lon, ele: item.ele || null, prio: 70, kbOnly: true, staffed: true });
    f.kb = item; item.f = f;
  }
}
(KB.valleys || []).forEach(i => linkKB(i, i.kind, "valleys"));
(KB.peaks || []).forEach(i => linkKB(i, i.kind, "peaks"));
(KB.huts || []).forEach(i => linkKB(i, "schronisko", "huts"));
(KB.trails || []).forEach(i => i.group = "trails");
const KBALL = [...(KB.valleys || []), ...(KB.peaks || []), ...(KB.huts || []), ...(KB.trails || [])];

/* ---------- TOPR data ---------- */
const T = D.topr || { incidents: [], ranking: [], geo: {} };
const INC = T.incidents || [];
const RANK = (T.ranking || []).filter(r => r.place);
const placeFeature = {};
function findByName(name) {
  const n = norm(name); let best = null;
  for (const f of FE) if ((f.n === n || f.na === n) && (!best || (f.kb && !best.kb) || (!!f.pl > !!best.pl) || (f.prio > best.prio && !!f.kb === !!best.kb))) best = f;
  return best;
}
for (const r of RANK) {
  const g = (T.geo || {})[r.place];
  let f = null;
  if (g && g.fid != null) f = null;
  if (g && g.name) f = findByName(g.name);
  if (!f) f = findByName(r.place);
  if (!f && g && g.lat) f = add({ k: "topr", name: r.place, alt: "", lat: g.lat, lon: g.lon, prio: 40 });
  if (f) { f.hot += r.count; f.prio = Math.max(f.prio, 55) + Math.min(25, r.count); placeFeature[r.place] = f; r.f = f; }
}
const incByPlace = {};
INC.forEach((x, i) => { (incByPlace[x.primary_place] = incByPlace[x.primary_place] || []).push(x); });
function incidentsFor(f) {
  const out = [];
  for (const [p, list] of Object.entries(incByPlace)) { const pf = placeFeature[p]; if (pf === f || (!pf && norm(p) === f.n)) out.push(...list); }
  return out;
}

/* ---------- Photos ---------- */
const PH = (D.photos || []).filter(p => p.file);

/* ---------- Map ---------- */
const B = D.bounds;
const map = L.map("map", { zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, minZoom: 10, maxZoom: 16.5, maxBounds: [[B.south - 0.04, B.west - 0.08], [B.north + 0.04, B.east + 0.08]], maxBoundsViscosity: 0.7, zoomControl: false });
L.control.zoom({ position: "bottomright" }).addTo(map);
let mapInit = false;
L.imageOverlay("relief.jpg", [[B.south, B.west], [B.north, B.east]], { className: "relief" }).addTo(map);
map.setView([49.23, 19.98], 11);
const DBGV = location.search.match(/v=([\d.]+),([\d.]+),([\d.]+)/);
map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution("Relief: Terrain Tiles (SRTM i in.), dane: © OpenStreetMap (ODbL)");

const LAYERS = store.get("layers", { peak: true, saddle: true, valley: true, zleb: true, lake: true, stream: true, trail: true, hut: true, cave: false, place: true, ridge: true, border: true, aerial: true, hot: true, photo: true, rescue: true });
const LAYERDEF = [
  ["Teren", [["peak", "▲", "Szczyty"], ["saddle", ")(", "Przełęcze"], ["valley", "~", "Doliny"], ["zleb", "⌇", "Żleby i kotły"], ["ridge", "≈", "Granie, grzbiety"]]],
  ["Woda", [["lake", "●", "Stawy"], ["stream", "∿", "Potoki"]]],
  ["Ludzie", [["trail", "▬", "Szlaki"], ["hut", "■", "Schroniska"], ["rescue", "✚", "Ratownictwo"], ["aerial", "┼", "Koleje linowe"], ["place", "·", "Miejscowości, polany"], ["cave", "◒", "Jaskinie"]]],
  ["Nauka", [["border", "- -", "Granica PL/SK"], ["hot", "◉", "Miejsca akcji TOPR"], ["photo", "◘", "Zdjęcia"]]]
];
const layerOf = f => ({ peak: "peak", saddle: "saddle", valley: "valley", kociol: "zleb", zleb: "zleb", lake: "lake", stream: "stream", hut: "hut", cave: "cave", town: "place", locality: "place", ridge: "ridge", rescue: "rescue", waterfall: "stream", topr: "hot" }[f.k]);

const state = { sel: null, blind: false, quiz: null, hover: null };
const dpr = Math.min(window.devicePixelRatio || 1, 2);
let hits = [], cvOff = { x: 0, y: 0 };

const Canvas = L.Layer.extend({
  onAdd(m) {
    this.c = L.DomUtil.create("canvas", "leaflet-zoom-hide");
    this.c.style.pointerEvents = "none";
    m.getPanes().overlayPane.appendChild(this.c);
    this.ctx = this.c.getContext("2d");
    m.on("moveend zoomend resize viewreset", this.redraw, this);
    this.redraw();
  },
  redraw() { draw(this.c, this.ctx); }
});
let layer = null;
const redraw = () => layer && layer.redraw();

const FONT = {
  peak: "600 12px 'IBM Plex Sans',system-ui,sans-serif", ele: "500 10px 'IBM Plex Mono',monospace",
  saddle: "italic 500 11.5px 'Source Serif 4',Georgia,serif", valley: "italic 600 14px 'Source Serif 4',Georgia,serif",
  zleb: "italic 400 11.5px 'Source Serif 4',Georgia,serif", lake: "italic 600 12px 'Source Serif 4',Georgia,serif",
  stream: "italic 400 11px 'Source Serif 4',Georgia,serif", hut: "700 12px 'IBM Plex Sans',system-ui,sans-serif",
  town: "700 13px 'Barlow Condensed','Arial Narrow',sans-serif", locality: "400 11.5px 'IBM Plex Sans',system-ui,sans-serif",
  ridge: "italic 500 12px 'Source Serif 4',Georgia,serif", hot: "700 11px 'IBM Plex Mono',monospace"
};
const COL = { ink: "#1b2220", peak: "#2a201a", saddle: "#3d3a36", valley: "#24543a", zleb: "#4a4a40", lake: "#1d5a91", stream: "#2b6aa3", hut: "#a3221b", town: "#1b2220", locality: "#3b4541", ridge: "#5a4a3a", halo: "rgba(250,250,246,.92)" };
const TRC = { r: "#d0312d", b: "#1f5fbf", g: "#1d8a3c", y: "#e0b000", k: "#111111" };
const thr = z => z < 10.75 ? 78 : z < 11.5 ? 64 : z < 12.25 ? 50 : z < 13 ? 38 : z < 13.75 ? 26 : z < 14.5 ? 14 : 0;

function draw(cv, ctx) {
  const size = map.getSize(), pad = 0.3;
  const W = Math.round(size.x * (1 + 2 * pad)), H = Math.round(size.y * (1 + 2 * pad));
  const tl = map.containerPointToLayerPoint([-size.x * pad, -size.y * pad]);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  L.DomUtil.setPosition(cv, tl);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const z = map.getZoom(), s = Math.pow(2, z), po = map.getPixelOrigin();
  const ox = po.x + tl.x, oy = po.y + tl.y;
  cvOff = { x: tl.x, y: tl.y, ox, oy, s };
  const X = w => w[0] * s - ox, Y = w => w[1] * s - oy;
  const inView = (x, y, m = 40) => x > -m && y > -m && x < W + m && y < H + m;
  const blind = state.blind;
  hits = [];
  const path = (gw, close) => { ctx.beginPath(); gw.forEach((w, i) => { const x = X(w), y = Y(w); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (close) ctx.closePath(); };
  const lineInView = gw => { for (let i = 0; i < gw.length; i += Math.max(1, gw.length >> 3)) if (inView(X(gw[i]), Y(gw[i]), 200)) return true; return inView(X(gw[gw.length - 1]), Y(gw[gw.length - 1]), 200); };

  // lakes
  if (LAYERS.lake) for (const f of FE) if (f.k === "lake" && lineInView(f.gw)) {
    path(f.gw, true); ctx.fillStyle = "rgba(70,140,200,.85)"; ctx.fill(); ctx.strokeStyle = "#245d8f"; ctx.lineWidth = .8; ctx.stroke();
  }
  // streams
  if (LAYERS.stream && z >= 11) { ctx.strokeStyle = "rgba(43,106,163,.75)"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const f of FE) if (f.k === "stream" && lineInView(f.gw)) { ctx.lineWidth = f.river ? 2.2 : (z >= 13 ? 1.3 : .9); path(f.gw); ctx.stroke(); } }
  // valley axes
  if (LAYERS.valley && z >= 12 && !blind) { ctx.setLineDash([2, 5]); ctx.strokeStyle = "rgba(36,84,58,.35)"; ctx.lineWidth = 1.2;
    for (const f of FE) if (f.k === "valley" && f.prio >= 50 && lineInView(f.gw)) { path(f.gw); ctx.stroke(); } ctx.setLineDash([]); }
  // border
  if (LAYERS.border) { for (const gw of BORDER) { path(gw); ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 5; ctx.stroke(); path(gw); ctx.strokeStyle = "#7a2a7a"; ctx.lineWidth = 2; ctx.setLineDash([9, 4, 2, 4]); ctx.stroke(); ctx.setLineDash([]); } }
  // trails
  if (LAYERS.trail && z >= 11) {
    const lw = z >= 14 ? 3 : z >= 13 ? 2.4 : 1.7;
    for (const t of TRAILS) if (lineInView(t.gw)) { path(t.gw); ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = lw + 2; ctx.stroke(); }
    for (const t of TRAILS) if (lineInView(t.gw)) {
      const cs = t.c.split("");
      cs.forEach((c, i) => { path(t.gw); ctx.strokeStyle = TRC[c] || "#c00"; ctx.lineWidth = lw; if (cs.length > 1) { ctx.setLineDash([7, 7 * (cs.length - 1)]); ctx.lineDashOffset = i * 7; } ctx.stroke(); });
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
  }
  // aerial
  if (LAYERS.aerial && z >= 11.5) for (const a of AERIAL) if (lineInView(a.gw)) { path(a.gw); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.4; ctx.stroke(); }
  // selection highlight (geometry)
  const sel = state.sel;
  const hl = (f, color) => {
    if (!f) return;
    if (f.gw) { path(f.gw, f.k === "lake"); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.stroke(); path(f.gw, f.k === "lake"); ctx.strokeStyle = color; ctx.lineWidth = 4.5; ctx.stroke(); }
    else { const x = X(f.w), y = Y(f.w); ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 6; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke(); }
  };
  if (sel) hl(sel, "#d0312d");
  const qz = state.quiz;
  if (qz && qz.show) hl(qz.show, qz.showColor || "#d0312d");
  if (qz && qz.click) {
    const cw = merc(qz.click[0], qz.click[1]); const x = X(cw), y = Y(cw);
    if (qz.show && qz.answered) { const tx = X(qz.show.w), ty = Y(qz.show.w); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.setLineDash([5, 4]); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fillStyle = "#111"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  }

  // TOPR hotspots
  if (LAYERS.hot && !(qz && qz.hideHot)) for (const r of RANK) if (r.f) {
    const x = X(r.f.w), y = Y(r.f.w); if (!inView(x, y)) continue;
    const R = 5 + 3.2 * Math.sqrt(r.count) * Math.min(1.4, Math.max(.6, (z - 10) / 3));
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fillStyle = "rgba(208,49,45,.22)"; ctx.fill(); ctx.strokeStyle = "rgba(208,49,45,.85)"; ctx.lineWidth = 1.5; ctx.stroke();
    if (!blind && z >= 11.5) { ctx.font = FONT.hot; ctx.fillStyle = "#a3221b"; ctx.textAlign = "center"; ctx.fillText(String(r.count), x, y - R - 3); ctx.textAlign = "left"; }
  }
  // photos
  if (LAYERS.photo && z >= 11.5 && !(qz && qz.hidePhotos)) for (const p of PH) {
    if (!p.w) p.w = merc(+p.lat, +p.lon);
    const x = X(p.w), y = Y(p.w); if (!inView(x, y)) continue;
    ctx.fillStyle = "#1f3b57"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 7, y - 5, 14, 10, 2) : ctx.rect(x - 7, y - 5, 14, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
    hits.push({ photo: p, x, y, r: 9 });
  }

  // points + labels with collision
  const t = thr(z), boxes = [], grid = new Map();
  const cell = 64;
  const collide = (b) => {
    const x0 = Math.floor(b[0] / cell), x1 = Math.floor(b[2] / cell), y0 = Math.floor(b[1] / cell), y1 = Math.floor(b[3] / cell);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const l = grid.get(i * 10007 + j); if (l) for (const o of l) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true; }
    return false;
  };
  const place = (b) => {
    const x0 = Math.floor(b[0] / cell), x1 = Math.floor(b[2] / cell), y0 = Math.floor(b[1] / cell), y1 = Math.floor(b[3] / cell);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const k = i * 10007 + j; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); }
  };
  const cand = [];
  for (const f of FE) {
    const lk = layerOf(f); if (!lk || !LAYERS[lk]) continue;
    if (f.k === "stream" && !f.river && z < 13.5) continue;
    if (f.k === "topr") continue;
    const p = f === sel ? 999 : f.prio;
    if (p < t) continue;
    const x = X(f.w), y = Y(f.w); if (!inView(x, y, 10)) continue;
    cand.push([p, f, x, y]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  const halo = (txt, x, y, color, font, align = "left") => {
    ctx.font = font; ctx.textAlign = align; ctx.strokeStyle = COL.halo; ctx.lineWidth = 3.2; ctx.strokeText(txt, x, y); ctx.fillStyle = color; ctx.fillText(txt, x, y);
  };
  const symbols = [];
  for (const [p, f, x, y] of cand) {
    const k = f.k;
    // symbol size / footprint
    let symR = 4;
    if (k === "peak") symR = 4.5; else if (k === "hut") symR = 6; else if (k === "town") symR = 3;
    const pointish = !["valley", "zleb", "kociol", "stream", "ridge", "lake"].includes(k);
    // label
    let font = FONT[k] || FONT.locality, color = COL[k] || COL.ink;
    if (k === "kociol") { font = FONT.zleb; color = COL.zleb; }
    if (k === "waterfall") { font = FONT.stream; color = COL.stream; }
    if (k === "rescue") { font = FONT.hut; color = COL.hut; }
    if (k === "valley" && f.prio < 50) font = "italic 600 12px 'Source Serif 4',Georgia,serif";
    let txt = k === "town" ? f.name.toUpperCase() : f.name;
    let placed = false;
    if (!blind || (qz && qz.reveal && qz.reveal.has(f))) {
      ctx.font = font; const tw = ctx.measureText(txt).width, th = 13;
      if (pointish) {
        const ele = (k === "peak" || k === "saddle") && f.ele && z >= 12 ? String(f.ele) : "";
        ctx.font = FONT.ele; const ew = ele ? ctx.measureText(ele).width : 0;
        const w = Math.max(tw, ew), h = ele ? 24 : th;
        const opts = [[x + symR + 3, y - (ele ? 6 : 0), "left"], [x - symR - 3 - w, y - (ele ? 6 : 0), "left"], [x - w / 2, y - symR - 3 - h + 6, "left"], [x - w / 2, y + symR + 9, "left"]];
        for (const [lx, ly] of opts) {
          const b = [lx - 1, ly - 7, lx + w + 1, ly - 7 + h + 1];
          if (!collide(b) && !collide([x - symR, y - symR, x + symR, y + symR])) {
            place(b); place([x - symR, y - symR, x + symR, y + symR]);
            halo(txt, lx, ly, color, font);
            if (ele) halo(ele, lx, ly + 12, "#4a4440", FONT.ele);
            hits.push({ f, x, y, r: 10, box: b });
            placed = true; break;
          }
        }
      } else {
        // linear / area label: rotated along geometry
        let ang = 0;
        if (f.gw && f.gw.length > 1 && k !== "lake") {
          const a = f.gw[0], b2 = f.gw[f.gw.length - 1];
          ang = Math.atan2((b2[1] - a[1]), (b2[0] - a[0]));
          if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
          if (k === "stream" || k === "zleb") { const i = Math.floor(f.gw.length / 2); const c1 = f.gw[Math.max(0, i - 1)], c2 = f.gw[Math.min(f.gw.length - 1, i + 1)]; ang = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; }
        }
        const lx = k === "lake" ? x : x, ly = k === "lake" ? y : y;
        const cw = Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * th, ch = Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * th;
        const b = [lx - cw / 2, ly - ch / 2, lx + cw / 2, ly + ch / 2];
        if (k === "lake" && f.area && Math.sqrt(f.area) * s / 256 / 120 < 0.0) { }
        if (!collide(b)) {
          place(b);
          ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
          if (k === "valley" && f.prio >= 50) { try { ctx.letterSpacing = "1.5px"; } catch (e) { } }
          halo(txt, 0, 0, color, font, "center");
          try { ctx.letterSpacing = "0px"; } catch (e) { }
          ctx.restore();
          hits.push({ f, x: lx, y: ly, r: 8, box: b });
          placed = true;
        }
      }
    }
    if (pointish && (placed || z >= 13 || blind)) symbols.push([f, x, y, symR]);
    else if (pointish && !placed && f === sel) symbols.push([f, x, y, symR]);
  }
  // symbols on top
  for (const [f, x, y, r] of symbols) {
    const k = f.k;
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#fff";
    if (k === "peak") { ctx.beginPath(); ctx.moveTo(x, y - r - 1); ctx.lineTo(x + r, y + r - 1); ctx.lineTo(x - r, y + r - 1); ctx.closePath(); ctx.fillStyle = "#2a201a"; ctx.fill(); ctx.stroke(); }
    else if (k === "saddle") { ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3.5; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(x + (i ? 5 : -5), y, 4.5, i ? Math.PI * .65 : -Math.PI * .35, i ? Math.PI * 1.35 : Math.PI * .35); ctx.stroke(); } ctx.strokeStyle = "#2a201a"; ctx.lineWidth = 1.6; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(x + (i ? 5 : -5), y, 4.5, i ? Math.PI * .65 : -Math.PI * .35, i ? Math.PI * 1.35 : Math.PI * .35); ctx.stroke(); } }
    else if (k === "hut") { ctx.fillStyle = f.staffed ? "#a3221b" : "#7d5a4a"; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.strokeRect(x - r, y - r, 2 * r, 2 * r); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x - 3.5, y + 1); ctx.lineTo(x, y - 3); ctx.lineTo(x + 3.5, y + 1); ctx.lineTo(x + 2.3, y + 1); ctx.lineTo(x + 2.3, y + 3.5); ctx.lineTo(x - 2.3, y + 3.5); ctx.lineTo(x - 2.3, y + 1); ctx.closePath(); ctx.fill(); }
    else if (k === "rescue") { ctx.fillStyle = "#fff"; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.strokeStyle = "#a3221b"; ctx.strokeRect(x - 6, y - 6, 12, 12); ctx.fillStyle = "#c3332b"; ctx.fillRect(x - 1.5, y - 4.5, 3, 9); ctx.fillRect(x - 4.5, y - 1.5, 9, 3); }
    else if (k === "cave") { ctx.beginPath(); ctx.arc(x, y + 2, 4, Math.PI, 0); ctx.closePath(); ctx.fillStyle = "#222"; ctx.fill(); ctx.stroke(); }
    else if (k === "town") { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = "#1b2220"; ctx.fill(); ctx.stroke(); }
    else if (k === "waterfall") { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fillStyle = "#2b6aa3"; ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fillStyle = "#3b4541"; ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
    if (!hits.some(h => h.f === f)) hits.push({ f, x, y, r: 9 });
  }
  // quiz target marker for "what is this"
  if (qz && qz.target && qz.markTarget) {
    const f = qz.target;
    if (f.gw && f.k !== "lake") { path(f.gw); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 9; ctx.stroke(); path(f.gw); ctx.strokeStyle = "#e0480f"; ctx.lineWidth = 5; ctx.stroke(); }
    else if (f.k === "lake") { path(f.gw, true); ctx.strokeStyle = "#e0480f"; ctx.lineWidth = 4; ctx.stroke(); }
    const x = X(f.w), y = Y(f.w);
    ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.strokeStyle = "#e0480f"; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fillStyle = "#e0480f"; ctx.fill();
  }
}

layer = new Canvas().addTo(map);

function hitTest(cp) {
  const x = cp.x - cvOff.x + map.containerPointToLayerPoint([0, 0]).x - 0, y = cp.y - cvOff.y + map.containerPointToLayerPoint([0, 0]).y;
  let best = null, bd = 14;
  for (const h of hits) {
    if (h.box && x >= h.box[0] && x <= h.box[2] && y >= h.box[1] && y <= h.box[3]) return h;
    const d = Math.hypot(h.x - x, h.y - y); if (d < (h.r || 10) + 4 && d < bd) { bd = d; best = h; }
  }
  if (best) return best;
  // lines & lakes
  const ll = map.containerPointToLatLng(cp), mpp = 40075016 * Math.cos(ll.lat * rad) / (256 * Math.pow(2, map.getZoom()));
  let bf = null, bdd = Infinity;
  for (const f of FE) {
    if (!f.geom) continue; const lk = layerOf(f); if (!LAYERS[lk]) continue;
    if (Math.abs(f.lat - ll.lat) > 0.08 || Math.abs(f.lon - ll.lng) > 0.12) continue;
    if (f.k === "lake" && pip(ll.lat, ll.lng, f.geom)) return { f };
    const d = distToLine(ll.lat, ll.lng, f.geom) / mpp;
    const tol = f.k === "valley" ? 14 : 7;
    if (d < tol && d < bdd) { bdd = d; bf = f; }
  }
  return bf ? { f: bf } : null;
}
map.on("click", e => {
  if (state.quiz) { if (state.quiz.onMapClick) state.quiz.onMapClick(e.latlng); return; }
  const h = hitTest(e.containerPoint);
  if (h && h.photo) { openPhoto(h.photo); return; }
  select(h ? h.f : null, false);
});
map.on("mousemove", e => {
  if (state.quiz && state.quiz.onMapClick) { map.getContainer().style.cursor = "crosshair"; return; }
  const h = hitTest(e.containerPoint); map.getContainer().style.cursor = h ? "pointer" : "";
});

function select(f, fly = true) {
  state.sel = f; redraw(); renderPanel();
  if (f && fly) focus(f);
  if (f && innerWidth <= 860) $("#side").scrollTop = 0;
}
function focus(f, minZ = 13.5) {
  if (f.geom && f.geom.length > 1) { const b = L.latLngBounds(f.geom.map(p => [p[0], p[1]])); map.flyToBounds(b.pad(f.k === "lake" ? 2.5 : 0.25), { maxZoom: 14.5, duration: .6 }); }
  else map.flyTo([f.lat, f.lon], Math.max(map.getZoom(), minZ), { duration: .6 });
}

/* ---------- Layers UI ---------- */
function renderLayers() {
  $("#layers").innerHTML = LAYERDEF.map(([g, items]) => `<h4>${g}</h4>` + items.map(([k, sym, label]) =>
    `<label><input type="checkbox" id="ly-${k}" data-k="${k}" ${LAYERS[k] ? "checked" : ""}><span class="legend-sym">${sym}</span>${label}</label>`).join("")).join("") +
    `<h4>Szlaki</h4><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="blaze r"></span><span class="blaze b"></span><span class="blaze g"></span><span class="blaze y"></span><span class="blaze k"></span></div>`;
  $("#layers").querySelectorAll("input").forEach(i => i.onchange = () => { LAYERS[i.dataset.k] = i.checked; store.set("layers", LAYERS); redraw(); });
}
renderLayers();
$("#btnLayers").onclick = () => { const h = $("#layers").hidden = !$("#layers").hidden; $("#btnLayers").setAttribute("aria-pressed", String(!h)); };
$("#btnBlind").onclick = () => { state.blind = !state.blind; $("#btnBlind").setAttribute("aria-pressed", String(state.blind)); redraw(); };

/* ---------- Search ---------- */
function search(q, limit = 12, filter) {
  const n = norm(q); if (!n) return [];
  const res = [];
  for (const f of FE) {
    if (!f.name || f.k === "stream" && !f.river && f.prio < 20) { }
    if (filter && !filter(f)) continue;
    let sc = -1;
    if (f.n === n || f.na === n) sc = 3; else if (f.n.startsWith(n) || f.na.startsWith(n)) sc = 2; else if (f.n.includes(" " + n) || f.n.includes(n)) sc = 1; else if (f.na.includes(n)) sc = .5;
    if (sc >= 0) res.push([sc * 100 + f.prio + (f.pl ? 5 : 0), f]);
  }
  res.sort((a, b) => b[0] - a[0]);
  const seen = new Set(), out = [];
  for (const [, f] of res) { const key = f.n + f.k; if (seen.has(key)) continue; seen.add(key); out.push(f); if (out.length >= limit) break; }
  return out;
}
const kindLabel = f => KIND[f.k] || f.k;
let qi = -1;
$("#q").addEventListener("input", () => {
  const r = search($("#q").value); qi = -1;
  $("#qres").hidden = !r.length;
  $("#qres").innerHTML = r.map((f, i) => `<li data-id="${f.id}" data-i="${i}"><span>${esc(f.name)}${f.alt ? ` <small>${esc(f.alt)}</small>` : ""}</span><small>${kindLabel(f)}${f.ele ? " · " + f.ele + " m" : ""}${f.pl ? "" : " · SK"}</small></li>`).join("");
});
$("#q").addEventListener("keydown", e => {
  const li = [...$("#qres").children]; if (!li.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); qi = (qi + (e.key === "ArrowDown" ? 1 : -1) + li.length) % li.length; li.forEach((l, i) => l.classList.toggle("hl", i === qi)); }
  if (e.key === "Enter") { const l = li[Math.max(0, qi)]; if (l) pick(+l.dataset.id); }
  if (e.key === "Escape") $("#qres").hidden = true;
});
$("#qres").addEventListener("click", e => { const l = e.target.closest("li"); if (l) pick(+l.dataset.id); });
function pick(id) { $("#qres").hidden = true; $("#q").value = FE[id].name; select(FE[id]); }
document.addEventListener("click", e => { if (!e.target.closest(".search")) $("#qres").hidden = true; });

/* ---------- Panel ---------- */
function nearby(f, kinds, maxD = 2200, n = 10) {
  const out = [];
  for (const g of FE) {
    if (g === f || !kinds.includes(g.k) || !g.name) continue;
    if (Math.abs(g.lat - f.lat) > 0.03 || Math.abs(g.lon - f.lon) > 0.045) continue;
    const d = dist(f.lat, f.lon, g.lat, g.lon); if (d > maxD) continue;
    out.push([d - g.prio * 8, d, g]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map(x => [x[1], x[2]]).sort((a, b) => a[0] - b[0]);
}
function photosNear(f, maxD = 2500) {
  return PH.filter(p => norm(p.title_pl) === f.n || (p.lat && dist(f.lat, f.lon, +p.lat, +p.lon) < maxD)).slice(0, 9);
}
function factsHTML(item) {
  if (!item || !item.facts || !item.facts.length) return "";
  return `<div class="qa"><div class="kicker">Sprawdź się</div>${item.facts.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join("")}</div>`;
}
function thumbsHTML(list) {
  if (!list.length) return "";
  return `<div class="thumbs">${list.map(p => `<img src="photos/${esc(p.file)}" alt="${esc(p.title_pl)}" data-ph="${esc(p.id || p.file)}" loading="lazy">`).join("")}</div>`;
}
function incidentsHTML(list, n = 6) {
  if (!list.length) return "";
  return `<div class="kicker">Akcje TOPR w tym miejscu (${list.length})</div><div style="display:grid;gap:8px">${list.slice(0, n).map(x => `<p class="incident">${esc(x.text)}<small>${esc(x.week || x.date || "")}${x.type ? " · " + esc(x.type) : ""}</small></p>`).join("")}</div>`;
}
function renderPanel() {
  const f = state.sel, P = $("#panel");
  if (state.quiz && state.quiz.panel) { P.innerHTML = state.quiz.panel(); state.quiz.bind && state.quiz.bind(P); return; }
  if (!f) {
    const top = RANK.slice(0, 8);
    P.innerHTML = `<div class="kicker">Jak korzystać</div>
      <h2>Mapa Tatr</h2>
      <div class="prose"><p>Kliknij szczyt, przełęcz, dolinę, staw albo schronisko. Zobaczysz opis, co leży w pobliżu i w którą stronę, zdjęcia oraz akcje TOPR z tego miejsca.</p>
      <p><strong>Mapa ślepa</strong> chowa nazwy. Klikaj w obiekty i sprawdzaj, czy wiesz, co to jest.</p>
      <p>Czerwone kółka to miejsca akcji TOPR z raportów tygodniowych. Im większe, tym więcej interwencji.</p></div>
      ${top.length ? `<div class="kicker">Najczęstsze miejsca akcji</div><div class="near">${top.map(r => `<button data-id="${r.f ? r.f.id : ""}"><span>${esc(r.place)}</span><small class="mono">${r.count}</small></button>`).join("")}</div>` : ""}
      <div class="kicker">Szybki start</div>
      <div class="near">${["Rysy", "Zawrat", "Giewont", "Kozi Wierch", "Dolina Pięciu Stawów Polskich", "Kasprowy Wierch", "Morskie Oko", "Dolina Kościeliska"].map(n => { const g = findByName(n); return g ? `<button data-id="${g.id}"><span>${esc(g.name)}</span><small>${kindLabel(g)}</small></button>` : ""; }).join("")}</div>`;
    P.querySelectorAll("[data-id]").forEach(b => b.onclick = () => b.dataset.id && select(FE[+b.dataset.id]));
    return;
  }
  const kb = f.kb;
  const tags = [];
  if (f.ele) tags.push(`<span class="tag mono">${f.ele} m n.p.m.</span>`);
  tags.push(`<span class="tag">${f.pl ? "Polska" : "Słowacja"}</span>`);
  const bd = borderDist(f.lat, f.lon); if (bd < 400) tags.push(`<span class="tag">na granicy</span>`); else if (bd < 3000 && !f.pl) tags.push(`<span class="tag">${fmtKm(bd)} od granicy</span>`);
  if (kb && kb.region) tags.push(`<span class="tag">${esc(kb.region)}</span>`);
  const inc = incidentsFor(f);
  if (f.hot || inc.length) tags.push(`<span class="tag red">Akcje TOPR: ${Math.max(f.hot, inc.length)}</span>`);
  const nb = nearby(f, ["peak", "saddle", "hut", "lake", "valley", "locality", "town", "rescue"], f.k === "valley" ? 3000 : 2200, 10);
  const ph = photosNear(f);
  let around = "";
  if (f.k === "valley" || f.k === "zleb" || f.k === "kociol") {
    const inside = FE.filter(g => ["peak", "saddle", "lake", "hut"].includes(g.k) && Math.abs(g.lat - f.lat) < .06 && Math.abs(g.lon - f.lon) < .08 && distToLine(g.lat, g.lon, f.geom) < 900).sort((a, b) => b.prio - a.prio).slice(0, 14);
    if (inside.length) around = `<div class="kicker">Nad doliną i w dolinie</div><div class="facts">${inside.map(g => `<button class="tag" data-id="${g.id}" style="border:0;cursor:pointer">${esc(g.name)}${g.ele ? ` <span class="mono">${g.ele}</span>` : ""}</button>`).join("")}</div>`;
  }
  $("#panel").innerHTML = `
    <div class="kicker">${esc(kb && kb.kind ? kb.kind : kindLabel(f))}</div>
    <div><h2>${esc(f.name)}</h2>${f.alt || (kb && kb.name_sk) ? `<div class="alt">${esc(f.alt || kb.name_sk)}</div>` : ""}</div>
    <div class="facts">${tags.join("")}</div>
    ${kb && kb.summary ? `<p style="margin:0;font-weight:500">${esc(kb.summary)}</p>` : ""}
    ${kb && kb.html ? `<div class="prose">${kb.html}</div>` : ""}
    ${kb && kb.neighbors && kb.neighbors.length ? `<div><div class="kicker">Sąsiednie doliny</div><p style="margin:4px 0 0">${kb.neighbors.map(esc).join(", ")}</p></div>` : ""}
    ${factsHTML(kb)}
    ${around}
    ${thumbsHTML(ph)}
    ${incidentsHTML(inc)}
    ${nb.length ? `<div class="kicker">W pobliżu (kierunek i odległość)</div><div class="near">${nb.map(([d, g]) => `<button data-id="${g.id}"><span>${esc(g.name)} <small>${kindLabel(g)}${g.ele ? ", " + g.ele + " m" : ""}</small></span><small class="mono">${DIRPL[bearing(f.lat, f.lon, g.lat, g.lon)]} ${fmtKm(d)}</small></button>`).join("")}</div>` : ""}
    <div class="row"><button class="btn ghost" id="pClose">Zamknij</button></div>`;
  $("#panel").querySelectorAll("[data-id]").forEach(b => b.onclick = () => select(FE[+b.dataset.id]));
  $("#panel").querySelectorAll("[data-ph]").forEach(i => i.onclick = () => openPhoto(PH.find(p => (p.id || p.file) === i.dataset.ph)));
  $("#pClose").onclick = () => select(null);
}

/* ---------- Photos lightbox ---------- */
function openPhoto(p, opts = {}) {
  if (!p) return;
  const lb = $("#lightbox");
  lb.innerHTML = `<img src="photos/${esc(p.file)}" alt="${esc(p.title_pl)}">
    <div class="cap"><b style="font:600 24px var(--f-sign)">${esc(p.title_pl)}</b><span>${esc(p.caption_pl || "")}</span>
    <small>Fot. ${esc(p.author || "nieznany")}, ${esc(p.license || "")} · <a href="${esc(p.source_url)}" target="_blank" rel="noopener">Wikimedia Commons</a></small>
    <div class="row" style="justify-content:center">${p.lat ? `<button class="btn" id="lbMap">Pokaż na mapie</button>` : ""}<button class="btn ghost" id="lbClose" style="color:#fff;border-color:#556">Zamknij</button></div></div>`;
  lb.hidden = false;
  $("#lbClose").onclick = () => lb.hidden = true;
  const m = $("#lbMap"); if (m) m.onclick = () => { lb.hidden = true; go("mapa"); const f = findByName(p.title_pl); if (f && dist(f.lat, f.lon, +p.lat, +p.lon) < 4000) select(f); else map.flyTo([+p.lat, +p.lon], 14); };
}
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#lightbox").hidden = true; });
$("#lightbox").addEventListener("click", e => { if (e.target.id === "lightbox") $("#lightbox").hidden = true; });

/* ---------- Routing ---------- */
const VIEWS = ["mapa", "uklad", "atlas", "akcje", "zdjecia", "quiz"];
const built = {};
function go(v) {
  if (!VIEWS.includes(v)) v = "mapa";
  document.querySelectorAll("section.view").forEach(s => s.classList.toggle("on", s.id === "v-" + v));
  document.querySelectorAll("nav.tabs a").forEach(a => { if (a.dataset.v === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (v === "mapa") { map.invalidateSize(); if (!mapInit) { mapInit = true; if (DBGV) map.setView([+DBGV[1], +DBGV[2]], +DBGV[3], { animate: false }); else map.fitBounds([[49.17, 19.80], [49.29, 20.14]]); } redraw(); }
  if (!built[v]) { built[v] = true; ({ uklad: buildUklad, atlas: buildAtlas, akcje: buildAkcje, zdjecia: buildZdjecia, quiz: buildQuiz }[v] || (() => { }))(); }
  if (location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
  if (v !== "mapa") window.scrollTo(0, 0);
}
document.querySelectorAll("nav.tabs a").forEach(a => a.addEventListener("click", e => { e.preventDefault(); go(a.dataset.v); }));
window.addEventListener("hashchange", () => go(location.hash.slice(1)));
function showOnMap(f) { if (!f) return; go("mapa"); setTimeout(() => select(f), 30); }

/* ---------- Układ Tatr ---------- */
function profileSVG(all) {
  const S = D.border || []; if (!PROF.length) return "";
  const k0 = 12.6, k1 = 57.6, sx = all ? 120 : 62, top = all ? 210 : 175, h = 240, e0 = 900, e1 = 2560;
  const W = Math.round((k1 - k0) * sx) + 40, H = top + h + 40;
  const X = k => 20 + (k - k0) * sx, Y = e => top + h - (e - e0) / (e1 - e0) * h;
  const pts = PROF.filter(p => p[0] >= k0 && p[0] <= k1 && p[1]);
  const area = `M${X(pts[0][0])},${top + h} ` + pts.map(p => `L${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ") + ` L${X(pts[pts.length - 1][0])},${top + h} Z`;
  const minor = /wrótk|szczerb|przełączk|turniczk|ząb|ławk|przechód|igła|baszt|czuba|kapucyn|mnich|słup|zwornik|štrbin|veža|vežič/i;
  const items = S.filter(o => o.km >= k0 && o.km <= k1).map(o => ({ ...o, ele: o.ele || (PROF.find(p => p[0] >= o.km) || [0, 0])[1], major: o.kind === "peak" ? !minor.test(o.name) || o.ele >= 2300 : /przełęcz|liliowe|zawracie|karb|sedlo/i.test(o.name) && !/przełączk/i.test(o.name) }));
  const cand = items.filter(o => all || o.major).sort((a, b) => (b.kind === "peak") - (a.kind === "peak") || (b.ele || 0) - (a.ele || 0));
  const kept = [];
  for (const o of cand) { const x = X(o.km); if (kept.every(k => Math.abs(X(k.km) - x) >= 13)) kept.push(o); }
  kept.sort((a, b) => a.km - b.km);
  let g = "";
  for (let e = 1000; e <= 2500; e += 250) g += `<line class="pgrid" x1="20" x2="${W - 20}" y1="${Y(e)}" y2="${Y(e)}"/><text class="paxis" x="24" y="${Y(e) - 4}">${e}</text>`;
  const lil = items.find(o => o.name === "Liliowe");
  if (lil) g += `<line x1="${X(lil.km)}" x2="${X(lil.km)}" y1="${top - 10}" y2="${top + h}" stroke="var(--red)" stroke-dasharray="4 4"/><text class="pzone" x="${X(lil.km) - 10}" y="${top + h + 26}" text-anchor="end">← Tatry Zachodnie</text><text class="pzone" x="${X(lil.km) + 10}" y="${top + h + 26}">Tatry Wysokie →</text>`;
  const labels = kept.map(o => {
    const x = X(o.km), y = Y(o.ele || 1500), f = findByName(o.name);
    const id = f ? f.id : "";
    return `<g data-id="${id}"><line x1="${x}" x2="${x}" y1="${y - 3}" y2="${y - 12}" stroke="var(--muted)"/>` +
      (o.kind === "peak" ? `<path d="M${x - 4},${y + 1} L${x},${y - 6} L${x + 4},${y + 1} Z" fill="var(--ink)"/>` : `<circle cx="${x}" cy="${y - 1}" r="2.5" fill="var(--muted)"/>`) +
      `<text class="ptext ${o.kind === "saddle" ? "pass" : ""}" transform="translate(${x + 4},${y - 15}) rotate(-90)">${esc(o.name)}${o.ele ? " " + o.ele : ""}</text></g>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profil grzbietu granicznego">${g}<path class="parea" d="${area}"/>${labels}
    <text class="paxis" x="${X(k0)}" y="${top + h + 14}">zach.</text><text class="paxis" x="${X(k1) - 30}" y="${top + h + 14}">wsch.</text></svg>`;
}
function buildUklad() {
  const st = [...(KB.structure || []), ...((KB.extra || {}).sections || [])];
  const vals = (KB.valleys || []).filter(v => v.country !== "SK" && !v.parent && v.kind === "dolina" && v.lon).sort((a, b) => a.lon - b.lon);
  const kids = id => (KB.valleys || []).filter(v => v.parent === id);
  $("#ukladPage").innerHTML = `
    <header><h2>Układ Tatr</h2><p>Jak zbudowane jest pasmo: podział, grań graniczna, doliny po polskiej stronie z zachodu na wschód. Najpierw zrozum szkielet, potem dokładaj szczegóły na mapie.</p></header>
    <div class="cols">
      <div class="essay">
        ${st.map(s => `<section id="st-${esc(s.id)}"><h3>${esc(s.title)}</h3><div class="prose">${s.html}</div></section>`).join("") || `<p class="empty">Opis układu jeszcze się wczytuje.</p>`}
      </div>
      <nav class="toc" aria-label="Spis treści">${st.map(s => `<a href="#uklad" data-to="st-${esc(s.id)}">${esc(s.title)}</a>`).join("")}<a href="#uklad" data-to="grzbiet">Profil grani granicznej</a><a href="#uklad" data-to="doliny">Doliny polskie W→E</a></nav>
    </div>
    <section id="grzbiet" style="display:grid;gap:12px">
      <h3 style="font-size:30px">Grań graniczna od zachodu na wschód</h3>
      <p style="max-width:70ch;margin:0;color:var(--muted)">Wszystkie nazwane szczyty i przełęcze leżące na granicy PL/SK, w kolejności, z wysokościami. Profil liczony z modelu terenu wzdłuż granicy. Kliknij nazwę, żeby zobaczyć ją na mapie.</p>
      <div class="row"><div class="seg" role="group" aria-label="Gęstość"><button aria-pressed="true" data-all="0">Najważniejsze</button><button aria-pressed="false" data-all="1">Wszystkie obiekty</button></div></div>
      <div class="scrollx" id="profile">${profileSVG(false)}</div>
      <details class="card"><summary style="cursor:pointer;font-weight:600">Lista tekstowa (do nauki na pamięć)</summary>
        <ol style="columns:3 220px;font-size:14px;margin-top:10px">${(D.border || []).filter(o => o.km > 12.5 && o.km < 57.6).map(o => `<li>${o.kind === "saddle" ? "<i>" : "<b>"}${esc(o.name)}${o.kind === "saddle" ? "</i>" : "</b>"} <span class="mono" style="color:var(--muted)">${o.ele || ""}</span></li>`).join("")}</ol></details>
    </section>
    <section id="doliny" style="display:grid;gap:12px">
      <h3 style="font-size:30px">Polskie doliny z zachodu na wschód</h3>
      ${vals.length ? `<div class="scrollx"><table class="vt"><thead><tr><th>Dolina</th><th>Region</th><th>Odnogi</th><th>W skrócie</th></tr></thead><tbody>${vals.map(v => `<tr><td><button data-kb="${esc(v.id)}">${esc(v.name)}</button></td><td>${esc(v.region || "")}</td><td>${kids(v.id).map(k => `<button data-kb="${esc(k.id)}">${esc(k.name)}</button>`).join(", ")}</td><td>${esc(v.summary || "")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">Tabela dolin pojawi się po wczytaniu opisów.</p>`}
    </section>`;
  const P = $("#ukladPage");
  P.querySelectorAll("[data-to]").forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.to).scrollIntoView({ behavior: "smooth" }); });
  P.querySelectorAll("[data-kb]").forEach(b => b.onclick = () => { const it = KBALL.find(i => i.id === b.dataset.kb); it && it.f && showOnMap(it.f); });
  const bindProf = () => $("#profile").querySelectorAll("g[data-id]").forEach(gg => gg.onclick = () => gg.dataset.id && showOnMap(FE[+gg.dataset.id]));
  bindProf();
  P.querySelectorAll(".seg button").forEach(b => b.onclick = () => { P.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("#profile").innerHTML = profileSVG(b.dataset.all === "1"); bindProf(); });
}

/* ---------- Atlas ---------- */
function buildAtlas() {
  const groups = [["all", "Wszystko"], ["valleys", "Doliny i polany"], ["peaks", "Szczyty i przełęcze"], ["trails", "Szlaki"], ["huts", "Schroniska i ratownictwo"]];
  const st = { g: "all", q: "", side: "all" };
  $("#atlasPage").innerHTML = `<header><h2>Atlas</h2><p>Opisy dolin, szczytów, przełęczy, szlaków i schronisk. Każdy wpis ma pytania kontrolne i link do mapy.</p></header>
    <div class="filters"><input type="search" id="aq" placeholder="Filtruj po nazwie lub treści" aria-label="Filtruj atlas">
    <div class="seg" id="ag">${groups.map(([k, l]) => `<button data-g="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("")}</div>
    <div class="seg" id="as"><button data-s="all" aria-pressed="true">PL + SK</button><button data-s="PL" aria-pressed="false">Tylko PL</button></div></div>
    <div class="grid" id="alist"></div>`;
  const render = () => {
    const n = norm(st.q);
    const list = KBALL.filter(i => (st.g === "all" || i.group === st.g) && (st.side === "all" || (i.country || "PL").includes("PL")) && (!n || norm(i.name + " " + (i.name_sk || "") + " " + (i.summary || "") + " " + (i.html || "")).includes(n)));
    $("#alist").innerHTML = list.length ? list.map(i => `<article class="entry" data-id="${esc(i.id)}">
      <h3>${i.colors ? i.colors.map(c => `<span class="blaze ${({ red: "r", blue: "b", green: "g", yellow: "y", black: "k", czerwony: "r", niebieski: "b", zielony: "g", żółty: "y", czarny: "k" })[c] || "r"}"></span>`).join("") : ""}${esc(i.name)}${i.ele ? `<span class="mono">${i.ele} m</span>` : ""}</h3>
      <div class="meta">${esc([i.kind || ({ trails: "szlak", huts: "schronisko" })[i.group], i.region, i.country].filter(Boolean).join(" · "))}${i.name_sk ? ` · <i>${esc(i.name_sk)}</i>` : ""}</div>
      <p class="sum">${esc(i.summary || (i.from ? i.from + " → " + i.to : ""))}</p>
      <div class="more" hidden></div>
      <div class="acts"><button class="btn ghost" data-more>Czytaj</button>${i.f ? `<button class="btn ghost" data-map>Na mapie</button>` : ""}</div></article>`).join("") : `<p class="empty">Brak wpisów dla tego filtra.</p>`;
    $("#alist").querySelectorAll(".entry").forEach(el => {
      const it = KBALL.find(i => i.id === el.dataset.id);
      el.querySelector("[data-more]").onclick = e => {
        const m = el.querySelector(".more"); m.hidden = !m.hidden; e.target.textContent = m.hidden ? "Czytaj" : "Zwiń";
        if (!m.dataset.f) { m.dataset.f = 1; m.innerHTML = `<div class="prose">${it.html || ""}</div>${factsHTML(it)}${it.f ? thumbsHTML(photosNear(it.f, 1800).slice(0, 6)) : ""}`; m.querySelectorAll("[data-ph]").forEach(img => img.onclick = () => openPhoto(PH.find(p => (p.id || p.file) === img.dataset.ph))); }
        el.style.gridColumn = m.hidden ? "" : "1 / -1";
      };
      const mb = el.querySelector("[data-map]"); if (mb) mb.onclick = () => showOnMap(it.f);
    });
  };
  $("#aq").oninput = e => { st.q = e.target.value; render(); };
  $("#ag").onclick = e => { const b = e.target.closest("button"); if (!b) return; st.g = b.dataset.g; $("#ag").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); };
  $("#as").onclick = e => { const b = e.target.closest("button"); if (!b) return; st.side = b.dataset.s; $("#as").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); render(); };
  render();
}

/* ---------- Akcje TOPR ---------- */
function buildAkcje() {
  const P = $("#akcjePage");
  if (!INC.length) { P.innerHTML = `<header><h2>Akcje TOPR</h2><p>Dane z raportów tygodniowych jeszcze nie zostały dołączone.</p></header>`; return; }
  const weeks = [...new Set(INC.map(i => i.week))].filter(Boolean).sort();
  const dates = INC.map(i => i.date).filter(Boolean).sort();
  const types = {}; INC.forEach(i => types[i.type] = (types[i.type] || 0) + 1);
  const max = RANK.length ? RANK[0].count : 1;
  P.innerHTML = `<header><h2>Akcje TOPR</h2><p>Gdzie ratownicy interweniują najczęściej, według tygodniowych podsumowań działań ratowniczych publikowanych przez TOPR. Te miejsca trzeba znać najlepiej: dojście, sąsiednie doliny, szlaki zejściowe.</p></header>
    <div class="statrow"><div class="stat"><b class="mono">${INC.length}</b><span>opisanych zdarzeń</span></div><div class="stat"><b class="mono">${weeks.length}</b><span>raportów tygodniowych</span></div><div class="stat"><b class="mono">${RANK.length}</b><span>różnych miejsc</span></div><div class="stat"><b class="mono" style="font-size:22px">${esc((dates[0] || weeks[0] || "").slice(0, 10))} – ${esc((dates[dates.length - 1] || weeks[weeks.length - 1] || "").slice(-10))}</b><span>zakres dat</span></div></div>
    <div class="facts">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="tag">${esc(t)} <b class="mono">${n}</b></span>`).join("")}</div>
    <div class="cols" style="grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)">
      <div class="card"><div class="rank" id="rk">${RANK.slice(0, 60).map((r, i) => `<button data-i="${i}"><span class="n">${i + 1}</span><span><span style="font-weight:600">${esc(r.place)}</span><span class="bar" style="width:${Math.max(4, r.count / max * 100)}%"></span><span class="types">${Object.entries(r.types || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => esc(t) + " " + n).join(" · ")}</span></span><span class="cnt">${r.count}</span></button>`).join("")}</div></div>
      <div id="rkd" class="card" style="position:sticky;top:calc(var(--hdr) + 12px);display:grid;gap:10px;max-height:calc(100vh - var(--hdr) - 40px);overflow:auto"><p class="empty" style="margin:0">Wybierz miejsce z rankingu, żeby zobaczyć opisy akcji.</p></div>
    </div>`;
  const show = i => {
    const r = RANK[i]; P.querySelectorAll("#rk button").forEach(b => b.classList.toggle("sel", +b.dataset.i === i));
    const list = incByPlace[r.place] || [];
    $("#rkd").innerHTML = `<div class="kicker">Miejsce #${i + 1}</div><h3 style="font-size:28px">${esc(r.place)}</h3>
      <div class="row">${r.f ? `<button class="btn" id="rkMap">Pokaż na mapie</button>` : `<span class="empty">Brak dokładnej lokalizacji na mapie.</span>`}</div>
      ${r.f && r.f.kb ? `<p style="margin:0">${esc(r.f.kb.summary || "")}</p>` : ""}
      <div style="display:grid;gap:10px">${(list.length ? list : (r.examples || []).map(t => ({ text: t }))).map(x => `<p class="incident">${esc(x.text)}<small>${esc(x.week || x.date || "")}${x.type ? " · " + esc(x.type) : ""}${x.helicopter ? " · śmigłowiec" : ""}</small></p>`).join("")}</div>`;
    const m = $("#rkMap"); if (m) m.onclick = () => showOnMap(r.f);
  };
  P.querySelectorAll("#rk button").forEach(b => b.onclick = () => show(+b.dataset.i));
  show(0);
}

/* ---------- Zdjęcia ---------- */
function buildZdjecia() {
  const P = $("#zdjeciaPage");
  const regions = ["Tatry Zachodnie", "Tatry Wysokie", "Tatry Bielskie", "Podtatrze"];
  P.innerHTML = `<header><h2>Zdjęcia</h2><p>Ucz się rozpoznawać miejsca z widoku. Kliknij zdjęcie, żeby je powiększyć i zobaczyć na mapie, skąd jest.</p></header>` +
    (PH.length ? regions.map(r => { const l = PH.filter(p => (p.region || "Tatry Wysokie") === r); return l.length ? `<section style="display:grid;gap:12px"><h3 style="font-size:28px">${r}</h3><div class="gallery">${l.map(p => `<figure class="ph" style="margin:0"><img src="photos/${esc(p.file)}" alt="${esc(p.title_pl)}" loading="lazy" data-ph="${esc(p.id || p.file)}"><div><b>${esc(p.title_pl)}</b><span>${esc(p.caption_pl || "")}</span></div></figure>`).join("")}</div></section>` : ""; }).join("") : `<p class="empty">Zdjęcia jeszcze nie zostały dołączone.</p>`);
  P.querySelectorAll("[data-ph]").forEach(i => i.onclick = () => openPhoto(PH.find(p => (p.id || p.file) === i.dataset.ph)));
}

/* ---------- Quiz ---------- */
const stats = store.get("stats", {});
const skey = (f) => (f.k || f.group || "") + ":" + (f.name || f.q);
function record(key, ok) { const s = stats[key] || { a: 0, c: 0 }; s.a++; if (ok) s.c++; stats[key] = s; store.set("stats", stats); }
function weightedPick(list, keyf) {
  const w = list.map(x => { const s = stats[keyf(x)]; return s ? 1 + 3 * (s.a - s.c) / s.a + (s.c >= 3 && s.c === s.a ? -0.7 : 0) : 1.6; });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
const QCAT = [["core", "Najważniejsze obiekty"], ["peak", "Szczyty"], ["saddle", "Przełęcze"], ["valley", "Doliny"], ["lake", "Stawy"], ["hut", "Schroniska"], ["hot", "Miejsca akcji TOPR"]];
const QSCOPE = [["pl", "Polska strona"], ["border", "PL + 3 km za granicą"], ["all", "Całe Tatry"]];
const qcfg = store.get("qcfg", { cat: "core", scope: "border", level: "key" });
function quizPool(cat = qcfg.cat, scope = qcfg.scope, level = qcfg.level) {
  return FE.filter(f => {
    if (!f.name || f.k === "stream" || f.k === "cave" || f.k === "town" || f.k === "aerial" || f.k === "topr" && !f.hot) return false;
    if (cat === "core") { if (!(f.kb || f.hot || f.prio >= 60)) return false; }
    else if (cat === "hot") { if (!f.hot) return false; }
    else if (cat === "valley") { if (!(f.k === "valley" || (f.kb && f.kb.kind === "dolina"))) return false; }
    else if (f.k !== cat) return false;
    if (level === "key" && cat !== "core" && cat !== "hot" && !(f.kb || f.hot || f.prio >= (cat === "peak" ? 47 : cat === "saddle" ? 40 : cat === "lake" ? 30 : 45))) return false;
    if (scope === "pl" && !f.pl) return false;
    if (scope === "border" && !f.pl) { if (f._bd == null) f._bd = borderDist(f.lat, f.lon); if (f._bd > 3000) return false; }
    if (f.kbOnly && f.k === "locality" && !f.kb) return false;
    return true;
  });
}
function targetDist(f, lat, lon) {
  if (f.k === "lake" && pip(lat, lon, f.geom)) return 0;
  if (f.geom) return distToLine(lat, lon, f.geom);
  return dist(lat, lon, f.lat, f.lon);
}
function grade(d, f) {
  const tol = f.geom ? 1.6 : 1;
  if (d <= 250 * tol) return ["Dokładnie", 3, "ok"];
  if (d <= 700 * tol) return ["Blisko", 2, "ok"];
  if (d <= 1500 * tol) return ["W okolicy", 1, "bad"];
  return ["Pudło", 0, "bad"];
}
function buildQuiz() {
  const P = $("#quizPage");
  const allFacts = KBALL.flatMap(i => (i.facts || []).map(x => ({ ...x, item: i })));
  P.innerHTML = `<header><h2>Quiz</h2><p>Ćwicz tak, jak będzie na egzaminie: wskazywanie na mapie bez nazw, rozpoznawanie miejsc, kolejność obiektów na grani i pytania z opisów. Błędne odpowiedzi wracają częściej.</p></header>
    <div class="card" style="display:grid;gap:12px">
      <div class="kicker" style="font:600 12px var(--f-body);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Zakres pytań na mapie</div>
      <div class="seg" id="qcat">${QCAT.map(([k, l]) => `<button data-k="${k}" aria-pressed="${qcfg.cat === k}">${l}</button>`).join("")}</div>
      <div class="row"><div class="seg" id="qscope">${QSCOPE.map(([k, l]) => `<button data-k="${k}" aria-pressed="${qcfg.scope === k}">${l}</button>`).join("")}</div>
      <div class="seg" id="qlevel"><button data-k="key" aria-pressed="${qcfg.level === "key"}">Ważniejsze</button><button data-k="all" aria-pressed="${qcfg.level === "all"}">Wszystkie nazwane</button></div>
      <span class="score" id="qpool"></span></div>
    </div>
    <div class="quizgrid">
      <button class="mode" data-m="where"><b>Wskaż na mapie</b><span>Dostajesz nazwę, klikasz miejsce na mapie bez podpisów. Liczy się odległość.</span></button>
      <button class="mode" data-m="what"><b>Co to za miejsce?</b><span>Obiekt jest zaznaczony na ślepej mapie. Wybierz nazwę z czterech.</span></button>
      ${INC.length ? `<button class="mode" data-m="topr"><b>Gdzie była akcja?</b><span>Prawdziwy opis akcji TOPR bez nazwy miejsca. Wskaż je na mapie.</span></button>` : ""}
      <button class="mode" data-m="order"><b>Kolejność na grani</b><span>Ułóż obiekty grani granicznej od zachodu na wschód.</span></button>
      <button class="mode" data-m="facts" ${allFacts.length ? "" : "disabled"}><b>Pytania z opisów</b><span>${allFacts.length} pytań o doliny, szlaki, przełęcze i schroniska.</span></button>
      <button class="mode" data-m="photo" ${PH.length >= 4 ? "" : "disabled"}><b>Rozpoznaj ze zdjęcia</b><span>Zdjęcie i cztery odpowiedzi.</span></button>
      <button class="mode" data-m="dir"><b>Kierunki i sąsiedzi</b><span>W którą stronę od A leży B? Uczy orientacji w terenie.</span></button>
    </div>
    <div id="qarea"></div>
    <div class="card" id="qstats"></div>`;
  const updPool = () => { $("#qpool").textContent = quizPool().length + " obiektów w puli"; };
  const segs = (id, key) => $(id).onclick = e => { const b = e.target.closest("button"); if (!b) return; qcfg[key] = b.dataset.k; store.set("qcfg", qcfg); $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); updPool(); };
  segs("#qcat", "cat"); segs("#qscope", "scope"); segs("#qlevel", "level"); updPool();
  P.querySelectorAll(".mode").forEach(b => b.onclick = () => startMode(b.dataset.m, allFacts));
  renderStats();
}
function renderStats() {
  const el = $("#qstats"); if (!el) return;
  const e = Object.entries(stats); const a = e.reduce((s, [, v]) => s + v.a, 0), c = e.reduce((s, [, v]) => s + v.c, 0);
  const weak = e.filter(([, v]) => v.a - v.c > 0).sort((x, y) => (y[1].a - y[1].c) - (x[1].a - x[1].c)).slice(0, 15);
  el.innerHTML = `<div class="kicker" style="font:600 12px var(--f-body);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Twoje wyniki (zapisane w tej przeglądarce)</div>
    <p style="margin:6px 0" class="mono">${a} odpowiedzi · ${a ? Math.round(c / a * 100) : 0}% dobrych · ${e.length} różnych pytań</p>
    ${weak.length ? `<div>Do powtórki: ${weak.map(([k]) => `<span class="tag">${esc(k.split(":").slice(1).join(":"))}</span>`).join(" ")}</div>` : ""}
    ${a ? `<button class="btn ghost" id="qreset" style="margin-top:8px">Wyzeruj wyniki</button>` : ""}`;
  const r = $("#qreset"); if (r) r.onclick = () => { if (r.dataset.c) { Object.keys(stats).forEach(k => delete stats[k]); store.set("stats", stats); renderStats(); } else { r.dataset.c = 1; r.textContent = "Kliknij jeszcze raz, żeby potwierdzić"; } };
}
function endQuiz() {
  state.quiz = null; state.blind = false; $("#btnBlind").setAttribute("aria-pressed", "false"); redraw(); renderPanel(); renderStats();
}
function startMode(m, allFacts) {
  if (m === "where" || m === "what" || m === "topr") return mapQuiz(m);
  if (m === "facts") return factsQuiz(allFacts);
  if (m === "photo") return photoQuiz();
  if (m === "order") return orderQuiz();
  if (m === "dir") return dirQuiz();
}
function mapQuiz(mode) {
  const ROUND = 10;
  let pool = mode === "topr" ? INC.filter(i => placeFeature[i.primary_place]) : quizPool();
  if (pool.length < 4) { $("#qarea").innerHTML = `<p class="empty">Za mało obiektów w tym zakresie. Zmień kategorię albo zakres.</p>`; return; }
  const q = { n: 0, pts: 0, max: 0, hideHot: true, hidePhotos: true };
  state.quiz = q; state.sel = null; state.blind = true; $("#btnBlind").setAttribute("aria-pressed", "true");
  go("mapa");
  const used = new Set();
  const next = () => {
    q.n++; q.click = null; q.show = null; q.answered = false; q.reveal = null; q.markTarget = false; q.opts = null; q.choice = null;
    if (q.n > ROUND) { q.done = true; q.onMapClick = null; renderPanel(); return; }
    let t, inc = null;
    for (let i = 0; i < 30; i++) {
      if (mode === "topr") { inc = pool[Math.floor(Math.random() * pool.length)]; t = placeFeature[inc.primary_place]; }
      else t = weightedPick(pool, skey);
      if (!used.has(t)) break;
    }
    used.add(t); q.target = t; q.inc = inc;
    if (mode === "what") {
      q.markTarget = true;
      const same = pool.filter(g => g !== t && (g.k === t.k || (t.k === "valley" && g.k === "valley")) && g.n !== t.n);
      const near = same.map(g => [dist(t.lat, t.lon, g.lat, g.lon), g]).sort((a, b) => a[0] - b[0]).slice(0, 8).map(x => x[1]);
      const opts = shuffle(near).slice(0, 3); while (opts.length < 3 && same.length > opts.length) { const g = same[Math.floor(Math.random() * same.length)]; if (!opts.includes(g)) opts.push(g); }
      q.opts = shuffle([t, ...opts]);
      const jitter = () => (Math.random() - .5) * 0.02;
      map.flyTo([t.lat + jitter(), t.lon + jitter() * 1.5], 13, { duration: .6 });
      q.onMapClick = null;
    } else {
      q.onMapClick = ll => {
        if (q.answered) return;
        q.click = [ll.lat, ll.lng]; q.answered = true;
        const d = targetDist(t, ll.lat, ll.lng); const [txt, p, cls] = grade(d, t);
        q.result = { d, txt, cls }; q.pts += p; q.max += 3; record(skey(t), p >= 2);
        q.show = t; q.reveal = new Set([t, ...nearby(t, ["peak", "saddle", "hut", "lake", "valley"], 2500, 12).map(x => x[1])]);
        const b = L.latLngBounds([[ll.lat, ll.lng], [t.lat, t.lon]]); map.flyToBounds(b.pad(.6), { maxZoom: 14, duration: .6 });
        redraw(); renderPanel();
      };
      if (q.n === 1) map.flyTo([49.235, 19.98], 11.25, { duration: .5 });
    }
    redraw(); renderPanel();
  };
  q.panel = () => {
    if (q.done) return `<div class="qpanel"><div class="kicker">Koniec rundy</div><div class="q">Wynik: ${q.pts} / ${q.max || ROUND * 3}</div><div class="row"><button class="btn" id="qAgain">Jeszcze raz</button><button class="btn ghost" id="qEnd">Zakończ</button></div></div>`;
    const t = q.target;
    const head = `<div class="progress"><i style="width:${(q.n - 1) / ROUND * 100}%"></i></div><div class="score">Pytanie ${q.n} z ${ROUND} · punkty ${q.pts}</div>`;
    if (mode === "what") {
      return `<div class="qpanel">${head}<div class="kicker">Co jest zaznaczone na mapie?</div><div class="q">${esc(kindLabel(t))}${t.ele && q.choice ? " · " + t.ele + " m" : ""}</div>
        <div class="opts">${q.opts.map((o, i) => `<button data-i="${i}" class="${q.choice != null ? (o === t ? "ok" : (i === q.choice ? "bad" : "")) : ""}">${esc(o.name)}</button>`).join("")}</div>
        ${q.choice != null ? `${t.kb ? `<p style="margin:0">${esc(t.kb.summary || "")}</p>` : ""}<div class="row"><button class="btn" id="qNext">Dalej</button><button class="btn ghost" id="qEnd">Zakończ</button></div>` : `<div class="row"><button class="btn ghost" id="qEnd">Zakończ</button></div>`}</div>`;
    }
    const ask = mode === "topr" ? `<div class="kicker">Gdzie była ta akcja?</div><p class="incident" style="font-size:15px">${esc(maskPlaces(q.inc))}</p>` : `<div class="kicker">Wskaż na mapie</div><div class="q">${esc(t.name)}</div><div class="score">${esc(kindLabel(t))}${t.pl ? "" : " · Słowacja"}</div>`;
    return `<div class="qpanel">${head}${ask}
      ${q.answered ? `<div class="verdict ${q.result.cls}">${q.result.txt}: ${fmtKm(q.result.d)} od celu</div>${mode === "topr" ? `<div><b>${esc(q.inc.primary_place)}</b></div>` : ""}${t.kb ? `<p style="margin:0">${esc(t.kb.summary || "")}</p>` : ""}<div class="row"><button class="btn" id="qNext">Dalej</button><button class="btn ghost" id="qInfo">Opis miejsca</button><button class="btn ghost" id="qEnd">Zakończ</button></div>` : `<p class="empty" style="margin:0">Kliknij na mapie. Przybliżaj i przesuwaj, ile chcesz.</p><div class="row"><button class="btn ghost" id="qSkip">Nie wiem</button><button class="btn ghost" id="qEnd">Zakończ</button></div>`}</div>`;
  };
  q.bind = P => {
    const on = (id, fn) => { const b = P.querySelector(id); if (b) b.onclick = fn; };
    on("#qNext", next); on("#qEnd", () => { endQuiz(); go("quiz"); });
    on("#qAgain", () => mapQuiz(mode));
    on("#qSkip", () => { q.answered = true; q.click = null; q.result = { d: NaN, txt: "Pominięte", cls: "bad" }; q.max += 3; record(skey(q.target), false); q.show = q.target; q.reveal = new Set([q.target]); focus(q.target, 13); redraw(); renderPanel(); $("#panel").querySelector(".verdict").textContent = "Tu jest: " + q.target.name; });
    on("#qInfo", () => { const t = q.target; endQuiz(); select(t); });
    P.querySelectorAll(".opts button").forEach(b => b.onclick = () => {
      if (q.choice != null) return; q.choice = +b.dataset.i; const ok = q.opts[q.choice] === q.target;
      q.pts += ok ? 3 : 0; q.max += 3; record(skey(q.target), ok);
      q.reveal = new Set([q.target]); redraw(); renderPanel();
    });
  };
  next();
}
function maskPlaces(inc) {
  let t = inc.text || "";
  const names = [...(inc.places || []), inc.primary_place].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of names) {
    const words = n.split(/\s+/).filter(w => w.length > 3);
    for (const w of words) { const stem = w.slice(0, Math.max(4, w.length - 3)); t = t.replace(new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ]*", "gi"), "▒▒▒"); }
  }
  return t;
}
function factsQuiz(all) {
  const A = $("#qarea"); let n = 0, ok = 0;
  const next = () => {
    const x = weightedPick(all, x => "fakt:" + x.q); n++;
    A.innerHTML = `<div class="qbox"><div class="score">Pytanie ${n} · wiedziałem ${ok}</div><div class="kicker" style="color:var(--muted);font-size:13px">${esc(x.item.name)}</div><div class="q">${esc(x.q)}</div>
      <div class="row"><button class="btn" id="fShow">Pokaż odpowiedź</button><button class="btn ghost" id="fEnd">Zakończ</button></div><div id="fAns"></div></div>`;
    A.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#fEnd").onclick = () => { A.innerHTML = ""; renderStats(); };
    $("#fShow").onclick = () => {
      $("#fShow").remove();
      $("#fAns").innerHTML = `<p style="font-size:17px">${esc(x.a)}</p><div class="row"><button class="btn" id="fOk">Wiedziałem</button><button class="btn ghost" id="fBad">Nie wiedziałem</button>${x.item.f ? `<button class="btn ghost" id="fMap">Na mapie</button>` : ""}</div>`;
      $("#fOk").onclick = () => { ok++; record("fakt:" + x.q, true); next(); };
      $("#fBad").onclick = () => { record("fakt:" + x.q, false); next(); };
      const m = $("#fMap"); if (m) m.onclick = () => showOnMap(x.item.f);
    };
  };
  next();
}
function photoQuiz() {
  const A = $("#qarea"); let n = 0, ok = 0;
  const next = () => {
    const p = weightedPick(PH, p => "foto:" + p.title_pl); n++;
    const others = shuffle(PH.filter(o => o.title_pl !== p.title_pl && (o.region === p.region || Math.random() < .3))).filter((o, i, a) => a.findIndex(z => z.title_pl === o.title_pl) === i).slice(0, 3);
    const opts = shuffle([p, ...others]);
    A.innerHTML = `<div class="qbox"><div class="score">Zdjęcie ${n} · dobrze ${ok}</div><img class="qimg" src="photos/${esc(p.file)}" alt="Zdjęcie do rozpoznania"><div class="q">Co widać na zdjęciu?</div>
      <div class="opts">${opts.map((o, i) => `<button data-i="${i}">${esc(o.title_pl)}</button>`).join("")}</div><div id="pAfter"></div></div>`;
    A.scrollIntoView({ behavior: "smooth", block: "start" });
    A.querySelectorAll(".opts button").forEach(b => b.onclick = () => {
      if (A.querySelector(".opts .ok")) return;
      const good = opts[+b.dataset.i] === p; if (good) ok++; record("foto:" + p.title_pl, good);
      A.querySelectorAll(".opts button").forEach((x, i) => { if (opts[i] === p) x.classList.add("ok"); else if (x === b) x.classList.add("bad"); });
      $("#pAfter").innerHTML = `<p style="margin:0">${esc(p.caption_pl || "")}</p><div class="row"><button class="btn" id="pNext">Dalej</button><button class="btn ghost" id="pEnd">Zakończ</button></div>`;
      $("#pNext").onclick = next; $("#pEnd").onclick = () => { A.innerHTML = ""; renderStats(); };
    });
  };
  next();
}
function orderQuiz() {
  const A = $("#qarea");
  const minor = /wrótk|szczerb|przełączk|turniczk|ząb|ławk|przechód|igła|baszt|kapucyn|słup|zwornik|štrbin|veža|vežič|sedlo$/i;
  const S = (D.border || []).filter(o => o.km > 12.5 && o.km < 57.6 && !minor.test(o.name) && (o.ele || 0) > 1300).filter((o, i, a) => a.findIndex(z => z.name === o.name) === i);
  if (S.length < 8) { A.innerHTML = `<p class="empty">Brak danych o grani.</p>`; return; }
  let n = 0, ok = 0;
  const next = () => {
    n++;
    const k = 5, start = Math.floor(Math.random() * (S.length - k * 2));
    const pick = []; let i = start; while (pick.length < k && i < S.length) { pick.push(S[i]); i += 1 + Math.floor(Math.random() * 2); }
    const sh = shuffle([...pick]); const chosen = [];
    const render = () => {
      const done = chosen.length === pick.length;
      const good = done && chosen.every((c, j) => c === pick[j]);
      A.innerHTML = `<div class="qbox"><div class="score">Zadanie ${n} · dobrze ${ok}</div><div class="q">Ułóż od zachodu na wschód (wzdłuż granicy)</div>
        <div class="order">${sh.map((o, j) => { const pos = chosen.indexOf(o); return `<button data-j="${j}" ${pos >= 0 ? "disabled" : ""}><span class="k">${pos >= 0 ? pos + 1 : "·"}</span>${esc(o.name)} <span class="mono" style="color:var(--muted)">${o.kind === "saddle" ? "przeł." : "szczyt"}</span></button>`; }).join("")}</div>
        ${done ? `<div class="verdict ${good ? "ok" : "bad"}">${good ? "Dobrze!" : "Prawidłowo: " + pick.map(o => esc(o.name)).join(" → ")}</div><div class="row"><button class="btn" id="oNext">Dalej</button><button class="btn ghost" id="oEnd">Zakończ</button></div>` : `<div class="row"><button class="btn ghost" id="oUndo">Cofnij</button></div>`}</div>`;
      A.querySelectorAll(".order button").forEach(b => b.onclick = () => { chosen.push(sh[+b.dataset.j]); if (chosen.length === pick.length) { const g = chosen.every((c, j) => c === pick[j]); if (g) ok++; record("grań:" + pick.map(o => o.name).join("/"), g); } render(); });
      const u = $("#oUndo"); if (u) u.onclick = () => { chosen.pop(); render(); };
      const nx = $("#oNext"); if (nx) nx.onclick = next;
      const e = $("#oEnd"); if (e) e.onclick = () => { A.innerHTML = ""; renderStats(); };
    };
    render(); A.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  next();
}
function dirQuiz() {
  const A = $("#qarea"); let n = 0, ok = 0;
  const pool = quizPool("core", qcfg.scope, "key").filter(f => !f.geom || f.k === "lake");
  if (pool.length < 5) { A.innerHTML = `<p class="empty">Za mało obiektów.</p>`; return; }
  const next = () => {
    n++;
    let a, b, d;
    for (let i = 0; i < 50; i++) { a = pool[Math.floor(Math.random() * pool.length)]; const nb = nearby(a, ["peak", "saddle", "hut", "lake"], 3500, 12).filter(x => x[0] > 500 && (x[1].kb || x[1].prio >= 50 || x[1].hot)); if (nb.length) { [d, b] = nb[Math.floor(Math.random() * nb.length)]; break; } }
    if (!b) { A.innerHTML = `<p class="empty">Nie udało się wylosować pary.</p>`; return; }
    const dir = bearing(a.lat, a.lon, b.lat, b.lon);
    A.innerHTML = `<div class="qbox"><div class="score">Pytanie ${n} · dobrze ${ok}</div><div class="q">W którą stronę od: ${esc(a.name)} leży ${esc(b.name)}?</div>
      <div style="display:grid;grid-template-columns:repeat(3,72px);gap:6px;justify-content:start">${["NW", "N", "NE", "W", "", "E", "SW", "S", "SE"].map(x => x ? `<button class="btn ghost" data-d="${x}" style="padding:12px 0">${({ N: "Pn", NE: "Pn-Wsch", E: "Wsch", SE: "Pd-Wsch", S: "Pd", SW: "Pd-Zach", W: "Zach", NW: "Pn-Zach" })[x]}</button>` : `<span></span>`).join("")}</div><div id="dAfter"></div></div>`;
    A.scrollIntoView({ behavior: "smooth", block: "start" });
    A.querySelectorAll("[data-d]").forEach(btn => btn.onclick = () => {
      if ($("#dAfter").innerHTML) return;
      const g = btn.dataset.d === dir; if (g) ok++; record("kier:" + a.name + ">" + b.name, g);
      btn.style.borderColor = g ? "var(--ok)" : "var(--bad)";
      A.querySelector(`[data-d="${dir}"]`).style.background = "color-mix(in srgb,var(--ok) 20%,transparent)";
      $("#dAfter").innerHTML = `<p class="verdict ${g ? "ok" : "bad"}">${g ? "Dobrze" : "Nie"}: ${esc(b.name)} leży ${DIRPL[dir]} od: ${esc(a.name)}, ${fmtKm(d)}.</p><div class="row"><button class="btn" id="dNext">Dalej</button><button class="btn ghost" id="dMap">Pokaż na mapie</button></div>`;
      $("#dNext").onclick = next; $("#dMap").onclick = () => { showOnMap(a); };
    });
  };
  next();
}

/* ---------- Boot ---------- */
renderPanel();
go(location.hash.slice(1) || "mapa");
if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
})();
