// =============================================================
// util.js – kleine Hilfsfunktionen (Datum, Formatierung, Escaping)
// =============================================================

export const APP_VERSION = '3.14.0';

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

export function clone(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

/** HTML-Escaping für alles, was vom Nutzer kommt (Namen etc.). */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Volumen eines Satzes: Gewicht × Wdh; einseitig beide Seiten zusammen. */
export function setVol(s) {
  if (!s || !s.w) return 0;
  return s.rl != null ? s.w * ((s.rl || 0) + (s.rr || 0)) : s.w * (s.r || 0);
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
/** Großes Volumen: 12.450 kg / 12,5 t bzw. 27.450 lb. */
export function fmtVol(kg) {
  if (units.w === 'lb') return `${fmtBig(kg * LB_PER_KG)} lb`;
  return kg >= 10000 ? `${fmtNum(Math.round(kg / 100) / 10)} t` : `${fmtBig(kg)} kg`;
}

/** Satz als Text: "80 × 8" bzw. einseitig "20 × 10/9" (links/rechts). */
export function fmtSet(s, sep = ' × ') {
  const w = s.w == null ? '–' : fmtW(s.w, false);
  return s.rl != null ? `${w}${sep}${fmtNum(s.rl)}/${fmtNum(s.rr)}` : `${w}${sep}${fmtNum(s.r)}`;
}
