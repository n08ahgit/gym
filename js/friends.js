// =============================================================
// friends.js – Wettbewerb mit Freunden, ganz ohne Server
//
// Jeder hat einen kurzen Code (z. B. K7Q2MX) und einen Link
// gymapp-de.pages.dev/f/K7Q2MX. Die App legt Name + Kennzahlen (keine
// Trainingsdetails) unter diesem Code beim eigenen Cloudflare-Server ab
// und aktualisiert sie automatisch. Freunde fügen den Code einmal hinzu,
// danach holt die App deren Stand selbst. Ältere lange Links (#f=…) gehen weiter.
//
// Kennzahlen (alle aus den eigenen Daten berechnet):
//   s   aktuelle Streak (Tage)        b    beste Streak
//   w4  Trainings der letzten 28 Tage  v4   Volumen der letzten 28 Tage (kg)
//   x4  harte Sätze der letzten 28 Tage
//   e   bestes geschätztes Maximum der letzten 90 Tage je Grundübung
//   bw  Körpergewicht (7-Tage-Schnitt), falls eingetragen
// =============================================================

import { data, save } from './store.js';
import { addDays, dateStr, uid } from './util.js';
import { computeStreak } from './streak.js';
import { e1rm } from './stats.js';
import { bodyTrend } from './coach.js';
import { PUSH_SERVER, SHARE_BASE } from './push-config.js';

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

// ---------- Kurzer Code über den Server ----------

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1 (Verwechslung)
const API = PUSH_SERVER.replace(/\/$/, '');

/** Eigener kurzer Code (wird beim ersten Mal erzeugt). */
export function shortCode() {
  if (!data.profile.code) {
    const r = crypto.getRandomValues(new Uint8Array(6));
    data.profile.code = Array.from(r, (b) => ALPHA[b % ALPHA.length]).join('');
    data.profile.key = uid() + uid() + uid();
    save();
  }
  return data.profile.code;
}

export const shortLink = () => `${SHARE_BASE}/f/${shortCode()}`;

let lastPublish = 0;
/** Eigenen Stand beim Server ablegen (höchstens alle 2 Minuten, außer force). */
export async function publishMe(force = false) {
  if (!API || !data.profile.name || window.GYM_DEMO) return false; // Demo-Daten nie hochladen
  if (!force && Date.now() - lastPublish < 120000) return true;
  lastPublish = Date.now();
  shortCode();
  try {
    const res = await fetch(`${API}/friend/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ code: data.profile.code, key: data.profile.key, name: data.profile.name, stats: myStats() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Code (oder Link) → Freund vom Server holen. */
export async function fetchFriend(code) {
  const res = await fetch(`${API}/friend/${code}`);
  if (res.status === 404) throw new Error(`Code ${code} gibt es nicht – bitte prüfen.`);
  if (!res.ok) throw new Error('Server nicht erreichbar');
  const e = await res.json();
  return { id: 'c:' + code, code, name: String(e.name).slice(0, 24), t: e.t, stats: e.stats };
}

/** Aus Eingabe den kurzen Code lesen: "k7q2mx", "…/f/K7Q2MX" → "K7Q2MX". */
export function parseShort(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/f\/([A-Za-z2-9]{6})\b/) || s.match(/^([A-Za-z2-9]{6})$/);
  return m ? m[1].toUpperCase() : null;
}

/** Stand aller Freunde mit Code neu laden. Rückgabe: true, wenn sich etwas geändert hat. */
export async function refreshFriends() {
  let changed = false;
  await Promise.all(data.friends.filter((f) => f.code).map(async (f) => {
    try {
      const n = await fetchFriend(f.code);
      if (n.t !== f.t || n.name !== f.name) { Object.assign(f, n); changed = true; }
    } catch { /* offline oder gelöscht: alten Stand behalten */ }
  }));
  if (changed) save();
  return changed;
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
  if (f.id === data.profile.id || (f.code && f.code === data.profile.code)) return 'self';
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
