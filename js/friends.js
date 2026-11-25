// =============================================================
// friends.js – Wettbewerb mit Freunden, ganz ohne Server
//
// Jeder erzeugt einen Link mit seinem aktuellen Stand (Name + Kennzahlen,
// keine Trainingsdetails). Öffnet ein Freund den Link in seiner App, wird
// man in seiner Rangliste eingetragen bzw. aktualisiert. Den Link teilt
// man über WhatsApp, iMessage usw. – wer neu teilt, aktualisiert seinen Stand.
//
// Kennzahlen (alle aus den eigenen Daten berechnet):
//   s   aktuelle Streak (Tage)        b    beste Streak
//   w4  Trainings der letzten 28 Tage  v4   Volumen der letzten 28 Tage (kg)
//   x4  harte Sätze der letzten 28 Tage
//   e   bestes geschätztes Maximum der letzten 90 Tage je Grundübung
//   bw  Körpergewicht (7-Tage-Schnitt), falls eingetragen
// =============================================================

import { data, save } from './store.js';
import { addDays, dateStr } from './util.js';
import { computeStreak } from './streak.js';
import { e1rm } from './stats.js';
import { bodyTrend } from './coach.js';

export const BIG3 = { bench_press: 'Bankdrücken', squat: 'Kniebeuge', deadlift: 'Kreuzheben' };

/** Eigene Kennzahlen für den Freundes-Link. */
export function myStats(today = new Date()) {
  const from28 = dateStr(addDays(today, -27));
  const from90 = dateStr(addDays(today, -89));
  let w4 = 0, v4 = 0, x4 = 0;
  const e = {};
  for (const s of data.sessions) {
    const in28 = s.date >= from28;
    if (in28) w4++;
    for (const ex of s.exercises) {
      for (const st of ex.sets) {
        if (st.status !== 'done') continue;
        if (in28) { x4++; if (st.w && st.r) v4 += st.w * st.r; }
        if (s.date >= from90 && BIG3[ex.exId] && st.w && st.r) e[ex.exId] = Math.max(e[ex.exId] || 0, Math.round(e1rm(st.w, st.r) * 2) / 2);
      }
    }
  }
  const st = computeStreak(today);
  const bt = bodyTrend();
  return { s: st.current, b: st.best, w4, v4: Math.round(v4), x4, e, bw: bt ? Math.round(bt.current * 10) / 10 : null };
}

// ---------- Kodierung (Base64url, Umlaute-sicher) ----------

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function myCode() {
  return toB64(JSON.stringify({ v: 1, id: data.profile.id, n: data.profile.name || 'Ohne Name', t: Date.now(), st: myStats() }));
}

export function myLink() {
  const base = location.href.split('#')[0];
  return `${base}#f=${myCode()}`;
}

/** Code oder kompletter Link → Freundes-Objekt. Wirft bei ungültigem Inhalt. */
export function decodeFriend(input) {
  const m = String(input || '').trim().match(/(?:#f=)?([A-Za-z0-9_-]{20,})\s*$/);
  if (!m) throw new Error('Kein gültiger Freundes-Code.');
  const o = JSON.parse(fromB64(m[1]));
  if (o?.v !== 1 || !o.id || !o.st || typeof o.st.s !== 'number') throw new Error('Kein gültiger Freundes-Code.');
  return { id: String(o.id).slice(0, 40), name: String(o.n || 'Freund').slice(0, 24), t: Number(o.t) || Date.now(), stats: o.st };
}

/** Freund hinzufügen oder aktualisieren. Rückgabe: 'new' | 'updated' | 'old' | 'self'. */
export function upsertFriend(f) {
  if (f.id === data.profile.id) return 'self';
  const i = data.friends.findIndex((x) => x.id === f.id);
  if (i >= 0) {
    if (data.friends[i].t > f.t) return 'old';
    data.friends[i] = f;
    save();
    return 'updated';
  }
  data.friends.push(f);
  save();
  return 'new';
}

export function removeFriend(id) {
  data.friends = data.friends.filter((f) => f.id !== id);
  save();
}

// ---------- Ranglisten ----------

/** Kraft relativ zum Körpergewicht: Summe der Grundübungen / Körpergewicht. */
function relStrength(st) {
  const ids = Object.keys(BIG3);
  if (!st.bw || !ids.every((k) => st.e?.[k])) return null;
  return ids.reduce((a, k) => a + st.e[k], 0) / st.bw;
}

export const BOARDS = {
  consistency: { label: 'Konstanz', unit: 'Trainings', sub: 'letzte 4 Wochen', val: (st) => st.w4 },
  streak: { label: 'Streak', unit: 'Tage', sub: 'aktuelle Serie', val: (st) => st.s },
  volume: { label: 'Volumen', unit: 'kg', sub: 'letzte 4 Wochen', val: (st) => st.v4 },
  strength: { label: 'Kraft', unit: '× KG', sub: 'Bank + Kniebeuge + Kreuzheben ÷ Körpergewicht', val: relStrength },
};

/** Rangliste inkl. mir. Einträge ohne Wert stehen unten. */
export function leaderboard(key) {
  const b = BOARDS[key];
  const me = { id: data.profile.id, name: data.profile.name || 'Du', me: true, t: Date.now(), stats: myStats() };
  return [me, ...data.friends]
    .map((p) => ({ ...p, value: b.val(p.stats) }))
    .sort((a, c) => (c.value ?? -1) - (a.value ?? -1));
}
