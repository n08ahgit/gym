// =============================================================
// util.js – kleine Hilfsfunktionen (Datum, Formatierung, Escaping)
// =============================================================

export const APP_VERSION = '3.36.1';

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const pad = (n) => String(n).padStart(2, '0');

/** Lokales Datum als "JJJJ-MM-TT" (nicht UTC! sonst falscher Tag nach 23 Uhr). */
export function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "JJJJ-MM-TT" -> Date (lokale Mitternacht). */
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Wochentag-Index mit Montag = 0 … Sonntag = 6. */
export function weekdayIdx(d) {
  return (d.getDay() + 6) % 7;
}

/** Tage addieren (sommerzeitsicher, weil setDate statt Millisekunden). */
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Sekunden -> "3:05" */
export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}

/** Millisekunden -> "23:41" bzw. "1:05:09" */
export function fmtElapsed(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Millisekunden -> "1 h 12 min" / "52 min" */
export function fmtDurationLong(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** Zahl deutsch formatieren (Komma), null -> "–" */
export function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '–';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Großzahl mit Tausenderpunkt: 12345 -> "12.345" */
export function fmtBig(n) {
  return Math.round(n).toLocaleString('de-DE');
}

/** Eingabe -> Zahl. Leer -> null, ungültig -> NaN. Komma erlaubt. */
export function parseNum(s) {
  if (s == null) return null;
  s = String(s).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * Eigene Pausenzeit lesen. Zahl = Minuten.
 * "5" -> 300, "2,5" -> 150, "1:30" -> 90, "90s" -> 90. Ungültig -> null.
 */
export function parseRestInput(s) {
  s = String(s || '').trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  let sec;
  if (/^\d+:\d{1,2}$/.test(s)) {
    const [m, x] = s.split(':').map(Number);
    sec = m * 60 + x;
  } else if (/^\d+(\.\d+)?\s*s(ek)?$/.test(s)) {
    sec = parseFloat(s);
  } else if (/^\d+(\.\d+)?\s*(min|m)?$/.test(s)) {
    sec = parseFloat(s) * 60;
  } else return null;
  sec = Math.round(sec);
  return sec > 0 && sec <= 60 * 60 ? sec : null;
}

/** "2026-11-24" -> "Di, 24. Nov 2026" */
export function fmtDateLong(s) {
  const d = parseDate(s);
  return `${WD_SHORT[weekdayIdx(d)]}, ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Geheimer Schlüssel (kryptografisch sicher, 128 Bit) – z. B. Beweis, dass ein Freundes-Code dir gehört. */
export function secretKey() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function clone(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

/** HTML-Escaping für alles, was vom Nutzer kommt (Namen etc.). */
/**
 * Kennzahlen eines Freundes säubern (kommen von fremden Geräten/Links):
 * nur bekannte Felder, Zahlen als Zahlen, Texte gekürzt. Schützt die Anzeige vor
 * eingeschleustem HTML und kaputten Werten.
 */
const STAT_NUMS = ['s', 'b', 'w4', 'v4', 'x4', 'bw', 'c7', 'm4', 'p4', 'k4', 't4', 'fk', 'fp', 'fd', 'lt', 'av'];
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e13 ? v : null);
export function cleanStats(st) {
  if (!st || typeof st !== 'object') return {};
  const out = {};
  for (const k of STAT_NUMS) { const v = finite(st[k]); if (v != null) out[k] = v; }
  if (st.e && typeof st.e === 'object') {
    out.e = {};
    for (const k of ['bench_press', 'squat', 'deadlift']) { const v = finite(st.e[k]); if (v != null) out.e[k] = v; }
  }
  if (Array.isArray(st.dr)) out.dr = st.dr.slice(0, 5).filter((x) => Array.isArray(x) && finite(x[1]) != null).map(([n, c]) => [String(n ?? '').slice(0, 30), c]);
  if (st.live && typeof st.live === 'object' && finite(st.live.s) != null) out.live = { n: String(st.live.n ?? 'Training').slice(0, 24), s: st.live.s };
  if (st.ln != null) out.ln = String(st.ln).slice(0, 24);
  if (Array.isArray(st.tw) && st.tw.length === 7) {
    out.tw = st.tw.map((x) => {
      const n = Array.isArray(x) ? finite(x[0]) : null, h = Array.isArray(x) ? finite(x[1]) : null;
      return [n != null && n >= 0 ? Math.min(Math.round(n), 999) : 0, h != null && h >= 0 && h < 24 ? h : null];
    });
  }
  return out;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Volumen eines Satzes: Gewicht × Wdh; einseitig beide Seiten zusammen. */
/** Volumen eines Satzes. n = Anzahl Hanteln (2 bei beidseitigen Kurzhantel-Übungen, siehe coach.dumbbells). */
export function setVol(s, n = 1) {
  if (!s || !s.w) return 0;
  return n * (s.rl != null ? s.w * ((s.rl || 0) + (s.rr || 0)) : s.w * (s.r || 0));
}

// ---------- Gewichtseinheit (kg oder lb) ----------
// Gespeichert wird IMMER in kg. Nur Anzeige und Eingabe rechnen um.
export const LB_PER_KG = 2.20462262;
export const units = { w: 'kg' }; // wird von store.js / Einstellungen gesetzt
export const wu = () => units.w;
/** kg → Anzeige-Einheit (ungerundet). */
export const toW = (kg) => (kg == null ? kg : units.w === 'lb' ? kg * LB_PER_KG : kg);
/** Eingabe in Anzeige-Einheit → kg. */
export const fromW = (v) => (v == null || Number.isNaN(v) ? v : units.w === 'lb' ? v / LB_PER_KG : v);
/** Gewicht hübsch: 82,5 kg bzw. 182 lb (lb auf 0,5 gerundet). */
export function fmtW(kg, withUnit = true) {
  if (kg == null) return '–';
  const v = units.w === 'lb' ? Math.round(kg * LB_PER_KG * 2) / 2 : Math.round(kg * 100) / 100;
  return `${fmtNum(v)}${withUnit ? ` ${units.w}` : ''}`;
}
// Mit fester Einheit (pro Übung wählbar, z. B. Kabelturm in lb)
export const toU = (kg, u) => (kg == null ? kg : u === 'lb' ? kg * LB_PER_KG : kg);
export const fromU = (v, u) => (v == null || Number.isNaN(v) ? v : u === 'lb' ? v / LB_PER_KG : v);
export function fmtWU(kg, u, withUnit = true) {
  if (kg == null) return '–';
  const v = u === 'lb' ? Math.round(kg * LB_PER_KG * 2) / 2 : Math.round(kg * 100) / 100;
  return `${fmtNum(v)}${withUnit ? ` ${u === 'lb' ? 'lb' : 'kg'}` : ''}`;
}

/** Großes Volumen: 12.450 kg / 12,5 t bzw. 27.450 lb. */
export function fmtVol(kg) {
  if (units.w === 'lb') return `${fmtBig(kg * LB_PER_KG)} lb`;
  return kg >= 10000 ? `${fmtNum(Math.round(kg / 100) / 10)} t` : `${fmtBig(kg)} kg`;
}

/** Satz als Text: "80 × 8" bzw. einseitig "20 × 10/9" (links/rechts). u = Einheit erzwingen, sonst die des Satzes. */
export function fmtSet(s, sep = ' × ', u = null) {
  const unit = u || s.u || units.w;
  const w = s.w == null ? '–' : fmtWU(s.w, unit, false);
  return s.rl != null ? `${w}${sep}${fmtNum(s.rl)}/${fmtNum(s.rr)}` : `${w}${sep}${fmtNum(s.r)}`;
}
