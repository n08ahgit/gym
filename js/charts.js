// =============================================================
// charts.js – schlichte SVG-Diagramme (ohne Bibliothek)
//
// Regeln (dataviz-Skill): dünne Marken, Balken max. 24 px mit 4 px
// runder Kappe an der Spitze, Linien 2 px, Punkte r ≥ 4 mit Ring in
// Flächenfarbe, Hilfslinien 1 px durchgezogen und zurückhaltend,
// Beschriftung nur sparsam, Text nie in Datenfarbe.
// Interaktion: jedes Element mit data-tip zeigt beim Antippen einen
// Tooltip (siehe progress.js); Liniendiagramm mit Fadenkreuz.
// =============================================================

import { esc } from './util.js';

const C = {
  mark: '#c47a87',              // Bordeaux, 5,4:1 auf der Kartenfläche
  track: 'rgba(217, 138, 151,.18)', // gleiche Farbe, heller: "geplant"
  grid: 'rgba(255,255,255,.12)',
  axis: '#8e8e93',
  surface: '#1c1c1e',
};

/** Saubere Achsenwerte (0, 5, 10 …). */
export function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(+v.toFixed(6));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Rechteck mit runder Kappe nur oben (Basis eckig). */
function capBar(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Säulendiagramm "erledigt vs. geplant" pro Woche.
 * items: [{ label, done, planned, tip }]
 */
export function columnChart(items, { height = 170 } = {}) {
  const W = 340, H = height, padL = 22, padB = 22, padT = 10;
  const plotW = W - padL - 4, plotH = H - padB - padT;
  const max = Math.max(1, ...items.map((i) => Math.max(i.done, i.planned)));
  const ticks = niceTicks(max, Math.min(4, max));
  const top = ticks[ticks.length - 1];
  const slot = plotW / items.length;
  const bw = Math.min(24, Math.max(3, slot * 0.62));
  const y = (v) => padT + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(items.length / 7);
  let g = '';
  for (const t of ticks) {
    g += `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}" stroke-width="1"/>` +
      `<text x="${padL - 6}" y="${y(t) + 3.5}" text-anchor="end" class="ax">${t}</text>`;
  }
  items.forEach((it, i) => {
    const x = padL + i * slot + (slot - bw) / 2;
    const track = it.planned > 0 ? `<path d="${capBar(x, y(it.planned), bw, y(0) - y(it.planned))}" fill="${C.track}"/>` : '';
    const bar = it.done > 0 ? `<path d="${capBar(x, y(it.done), bw, y(0) - y(it.done))}" fill="${C.mark}"/>` : '';
    const lbl = i % labelEvery === 0 || i === items.length - 1
      ? `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="ax">${esc(it.label)}</text>` : '';
    // Trefferfläche = ganze Spalte (größer als die Marke)
    g += `<g class="hit" data-action="tip" data-tip="${esc(it.tip)}" tabindex="0" role="img" aria-label="${esc(it.tip)}">
      <rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" fill="transparent"/>${track}${bar}</g>${lbl}`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="aspect-ratio:${W}/${H}">${g}</svg>`;
}

/**
 * Liniendiagramm (eine Reihe) mit Fläche und Endpunkt.
 * pts: [{ x: 0..1 (Zeitposition), v: Wert, tip }]
 */
export function lineChart(pts, { height = 190, unit = '' } = {}) {
  const W = 340, H = height, padL = 34, padR = 10, padT = 12, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = pts.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 2; hi += 2; }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.15); hi += span * 0.15;
  const base = niceTicks(hi - lo, 3);
  const step = base[1] - base[0];
  const ticks = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-6; t += step) ticks.push(+t.toFixed(6));
  const X = (x) => padL + x * plotW;
  const Y = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${path} L${X(pts[pts.length - 1].x).toFixed(1)},${padT + plotH} L${X(pts[0].x).toFixed(1)},${padT + plotH} Z` : '';
  let g = '';
  for (const t of ticks) {
    g += `<line x1="${padL}" x2="${W - padR}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.grid}" stroke-width="1"/>` +
      `<text x="${padL - 6}" y="${Y(t) + 3.5}" text-anchor="end" class="ax">${Math.round(t)}</text>`;
  }
  const last = pts[pts.length - 1];
  g += area ? `<path d="${area}" fill="${C.mark}" opacity=".10"/>` : '';
  g += `<path d="${path}" fill="none" stroke="${C.mark}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  g += `<circle cx="${X(last.x)}" cy="${Y(last.v)}" r="4.5" fill="${C.mark}" stroke="${C.surface}" stroke-width="2"/>`;
  // Fadenkreuz-Ebene: Punkte als Daten für progress.js
  const data = pts.map((p) => ({ cx: +X(p.x).toFixed(1), cy: +Y(p.v).toFixed(1), tip: p.tip }));
  return `<div class="line-wrap"><svg class="chart line" viewBox="0 0 ${W} ${H}" style="aspect-ratio:${W}/${H}" data-points='${esc(JSON.stringify(data))}' data-w="${W}">
    ${g}<line class="xhair" x1="0" x2="0" y1="${padT}" y2="${padT + plotH}" stroke="rgba(255,255,255,.35)" stroke-width="1" visibility="hidden"/>
    <circle class="xdot" r="5" fill="${C.mark}" stroke="${C.surface}" stroke-width="2" visibility="hidden"/>
  </svg><div class="tip" hidden></div></div>`;
}

/** Mini-Verlauf für Listenzeilen (kein Achsen, Endpunkt betont). */
export function sparkline(values, { w = 64, h = 24 } = {}) {
  if (values.length < 2) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (w - 6), h - 3 - ((v - lo) / span) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="#a1a1a8" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="${C.mark}"/></svg>`;
}
