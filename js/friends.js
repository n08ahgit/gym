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
import { addDays, dateStr, uid, setVol } from './util.js';
import { computeStreak } from './streak.js';
import { e1rm } from './stats.js';
import { bodyTrend, dumbbells } from './coach.js';
import { PUSH_SERVER, SHARE_BASE } from './push-config.js';
import { caffeineStats } from './drinks.js';
import { dayStatus } from './year.js';
import { sessionsByDate, loadActive } from './store.js';
import { lastDays } from './nutrition.js';

export const BIG3 = { bench_press: 'Bankdrücken', squat: 'Kniebeuge', deadlift: 'Kreuzheben' };

/** Eigene Kennzahlen für den Freundes-Link. */
export function myStats(today = new Date()) {
  const from28 = dateStr(addDays(today, -27));
  const from90 = dateStr(addDays(today, -89));
  let w4 = 0, v4 = 0, x4 = 0, k4 = 0, t4 = 0;
  const e = {};
  for (const s of data.sessions) {
    const in28 = s.date >= from28;
    if (in28) w4++;
    for (const ex of s.exercises) {
      for (const st of ex.sets) {
        // Disziplin: geplante Sätze im Workout vs. übersprungene (einzelne Sätze oder ganze Übungen)
        if (in28) { t4++; if (st.status === 'skipped') k4++; }
        if (st.status !== 'done') continue;
        if (in28) { x4++; v4 += setVol(st, dumbbells(ex.exId)); }
        if (s.date >= from90 && BIG3[ex.exId] && st.w && st.r) e[ex.exId] = Math.max(e[ex.exId] || 0, Math.round(e1rm(st.w, st.r) * 2) / 2);
      }
    }
  }
  const st = computeStreak(today);
  const bt = bodyTrend();
  const caf = caffeineStats(7, today);
  // Gym geskippt: geplante Trainingstage der letzten 28 Tage (ohne heute), an denen nichts gespeichert wurde
  const todayStr = dateStr(today), byDate = sessionsByDate();
  let m4 = 0, p4 = 0;
  for (let i = 1; i <= 28; i++) {
    const ds = dateStr(addDays(today, -i));
    const stt = dayStatus(ds, todayStr, byDate);
    if (stt === 'missed') { m4++; p4++; } else if (stt === 'done') p4++;
  }
  // Essen: Ø kcal und Protein pro Tag der letzten 7 Tage – nur Tage, an denen etwas eingetragen wurde
  const food = lastDays(7, today);
  const fk = food.avg ? food.avg.kcal : null, fp = food.avg ? food.avg.p : null;
  return { s: st.current, b: st.best, w4, v4: Math.round(v4), x4, e, bw: bt ? Math.round(bt.current * 10) / 10 : null, c7: caf.mg, dr: caf.top, m4, p4, k4, t4, fk, fp, fd: food.count, ...presence(today), ...(data.profile.avatar && data.profile.avV ? { av: data.profile.avV } : {}) };
}

/**
 * Wann trainiere ich? (Jadons Wunsch) – nur, wenn in den Freunde-Einstellungen erlaubt.
 *   live: { n: Workout-Name, s: Start (ms) }  solange ein Workout läuft (höchstens 4 h)
 *   lt/ln: Ende + Name des letzten gespeicherten Workouts
 *   tw: 7 Wochentage (Mo–So) × [Anzahl, übliche Startzeit in Stunden] der letzten 8 Wochen
 */
export const shareTimes = () => data.settings.shareTimes !== false;
function presence(today = new Date()) {
  if (!shareTimes()) return {};
  const out = {};
  const a = loadActive();
  if (a?.startedAt && !a.endedAt && Date.now() - a.startedAt < 4 * 36e5) out.live = { n: String(a.workoutName || 'Training').slice(0, 24), s: a.startedAt };
  const last = data.sessions[data.sessions.length - 1];
  if (last) { out.lt = last.end || last.start; out.ln = String(last.workoutName || '').slice(0, 24); }
  const from = dateStr(addDays(today, -55));
  const tw = Array.from({ length: 7 }, () => [0, 0]);
  for (const s of data.sessions) {
    if (s.date < from || !s.start) continue;
    const d = new Date(s.start);
    const wd = (d.getDay() + 6) % 7;
    tw[wd][0]++;
    tw[wd][1] += d.getHours() + d.getMinutes() / 60;
  }
  out.tw = tw.map(([n, h]) => [n, n ? Math.round((h / n) * 2) / 2 : null]);
  return out;
}

/** Ist ein Freund gerade im Gym? (Stand höchstens 4 h alt) */
export const isLive = (st) => !!st?.live && Date.now() - st.live.s < 4 * 36e5 && Date.now() - st.live.s > -6e5;

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
let linkedOnce = false;

/** Dem Freund mit diesem Code mitteilen, dass ich ihn hinzugefügt habe. */
export async function linkTo(code) {
  if (!API || !data.profile.code || !data.profile.name || window.GYM_DEMO) return false;
  try {
    const r = await fetch(`${API}/friend/link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: data.profile.code, key: data.profile.key, to: code }) });
    return r.ok;
  } catch {
    return false;
  }
}

/** Wer hat mich hinzugefügt? Diese Freunde automatisch übernehmen (außer selbst entfernt). */
export async function syncInbox() {
  if (!API || !data.profile.code || window.GYM_DEMO) return [];
  try {
    const r = await fetch(`${API}/friend/inbox`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.profile.code, key: data.profile.key }) });
    if (!r.ok) return [];
    const { codes } = await r.json();
    const removed = data.settings.removed || [];
    const added = [];
    for (const c of codes) {
      if (c === data.profile.code || removed.includes(c) || data.friends.some((f) => f.code === c)) continue;
      try { const f = await fetchFriend(c); data.friends.push(f); added.push(f.name); } catch { /* weg */ }
    }
    if (added.length) save();
    return added;
  } catch {
    return [];
  }
}
/** Eigenen Stand beim Server ablegen (höchstens alle 2 Minuten, außer force). */
export async function publishMe(force = false) {
  if (!API || !data.profile.name || window.GYM_DEMO) return false; // Demo-Daten nie hochladen
  if (!force && Date.now() - lastPublish < 120000) return true;
  lastPublish = Date.now();
  shortCode();
  try {
    const res = await fetch(`${API}/friend/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ code: data.profile.code, key: data.profile.key, name: data.profile.name, stats: myStats(), pid: data.profile.id }),
    });
    // Einmal pro Sitzung: allen Freunden mitteilen, dass ich sie habe (→ sie bekommen mich automatisch)
    if (res.ok && !linkedOnce) { linkedOnce = true; data.friends.filter((f) => f.code).forEach((f) => linkTo(f.code)); registerPushSub(); }
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
/**
 * Alte Freunde (per langem Link hinzugefügt, ohne Code) auf Codes umstellen:
 * Server kennt Geräte-Kennung → Code. Danach automatisch und gegenseitig.
 */
async function upgradeOldFriends() {
  const old = data.friends.filter((f) => !f.code && f.id && !String(f.id).startsWith('demo'));
  if (!old.length || !API || window.GYM_DEMO) return false;
  let changed = false;
  for (const f of old) {
    try {
      const r = await fetch(`${API}/friend/byid/${encodeURIComponent(f.id)}`);
      if (!r.ok) continue;
      const { code } = await r.json();
      if (!code || code === data.profile.code) continue;
      const n = await fetchFriend(code);
      // Doppelte vermeiden (falls schon per Code vorhanden)
      data.friends = data.friends.filter((x) => x !== f && x.code !== code);
      data.friends.push(n);
      linkTo(code);
      changed = true;
    } catch { /* Freund hat noch keine neue Version – später nochmal */ }
  }
  if (changed) save();
  return changed;
}

// ---------- Anfeuern ----------

/** Eigene Push-Adresse beim Freundes-Code hinterlegen (sonst können Freunde dich nicht anfeuern). sub=null entfernt sie. */
export async function registerPushSub(remove = false) {
  if (!API || !data.profile.code || !data.profile.key) return false;
  let sub = null;
  try { sub = remove ? null : JSON.parse(localStorage.getItem('gym.push') || 'null')?.sub || null; } catch { /* egal */ }
  if (!sub && !remove) return false;
  try {
    const r = await fetch(`${API}/friend/pushsub`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.profile.code, key: data.profile.key, sub }) });
    return r.ok;
  } catch { return false; }
}

/** Motivationsnachricht schicken. Rückgabe: { ok, delivered } oder { error: 'rate' | 'friends' | 'net' } */
export async function sendCheer(toCode, text = '') {
  if (!API || !data.profile.code || !data.profile.key) return { error: 'name' };
  try {
    const r = await fetch(`${API}/friend/cheer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: data.profile.code, key: data.profile.key, to: toCode, text: String(text).slice(0, 120) }) });
    if (r.status === 429) return { error: 'rate' };
    if (r.status === 403) return { error: 'friends' };
    if (!r.ok) return { error: 'net' };
    return await r.json();
  } catch { return { error: 'net' }; }
}

/** Erhaltene Nachrichten abholen (werden danach beim Server gelöscht). */
export async function fetchCheers() {
  if (!API || !data.profile.code || !data.profile.key) return [];
  try {
    const r = await fetch(`${API}/friend/cheers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.profile.code, key: data.profile.key }) });
    return r.ok ? (await r.json()).cheers || [] : [];
  } catch { return []; }
}

/** Eigenes Profilbild setzen (data-URL, klein) oder entfernen (null). */
export async function setAvatar(img) {
  data.profile.avatar = img || null;
  data.profile.avV = img ? Date.now() : null;
  save();
  if (!API || !data.profile.code || !data.profile.key) return true;
  try {
    const r = await fetch(`${API}/friend/avatar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.profile.code, key: data.profile.key, img: img || null }) });
    const d = await r.json().catch(() => ({}));
    if (d.v) { data.profile.avV = d.v; save(); }
    await publishMe(true);
    return r.ok;
  } catch { return false; }
}

// Bilder der Freunde liegen getrennt (nicht in den Trainingsdaten → Speichern/Backups bleiben schnell)
const AVA = 'gym.ava.';
export function friendImg(f) {
  if (!f?.code) return f?.img || null;
  try { return localStorage.getItem(AVA + f.code) || f.img || null; } catch { return f.img || null; }
}
function storeFriendImg(code, img) {
  try { if (img) localStorage.setItem(AVA + code, img); else localStorage.removeItem(AVA + code); return true; } catch { return false; }
}

/** Profilbilder der Freunde nachladen, wenn sich ihre Version geändert hat. */
async function syncAvatars() {
  let changed = false;
  await Promise.all(data.friends.filter((f) => f.code).map(async (f) => {
    const v = f.stats?.av || null;
    if (f.img) { storeFriendImg(f.code, f.img); delete f.img; changed = true; } // alte Ablage umziehen
    if (!v) { if (f.av) { storeFriendImg(f.code, null); delete f.av; changed = true; } return; }
    if (f.av === v && friendImg(f)) return;
    try {
      const r = await fetch(`${API}/friend/${f.code}/avatar`);
      if (!r.ok) return;
      const a = await r.json();
      if (a?.img && storeFriendImg(f.code, a.img)) { f.av = v; changed = true; }
    } catch { /* offline */ }
  }));
  return changed;
}

export async function refreshFriends() {
  let changed = await upgradeOldFriends();
  changed = (await syncInbox()).length > 0 || changed;
  await Promise.all(data.friends.filter((f) => f.code).map(async (f) => {
    try {
      const n = await fetchFriend(f.code);
      if (n.t !== f.t || n.name !== f.name) { Object.assign(f, n); changed = true; }
    } catch { /* offline oder gelöscht: alten Stand behalten */ }
  }));
  if (await syncAvatars()) changed = true;
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
  if (f.code && data.settings.removed) data.settings.removed = data.settings.removed.filter((c) => c !== f.code);
  save();
  return 'new';
}

export function removeFriend(id) {
  const f = data.friends.find((x) => x.id === id);
  // Entfernte nicht über den Posteingang wieder automatisch hinzufügen
  if (f?.code) data.settings.removed = [...new Set([...(data.settings.removed || []), f.code])];
  data.friends = data.friends.filter((x) => x.id !== id);
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
  caffeine: { label: 'Koffein', unit: 'mg', sub: 'Koffein der letzten 7 Tage', val: (st) => (typeof st.c7 === 'number' ? st.c7 : null) },
  food: { label: 'Essen', unit: 'kcal/Tag', sub: 'Ø Kalorien pro Tag · letzte 7 Tage (eingetragene Tage)', val: (st) => (typeof st.fk === 'number' ? st.fk : null) },
  // Weniger ist besser (asc): wer am seltensten skippt bzw. auslässt, steht oben
  skips: { label: 'Gym-Skips', unit: 'geskippt', sub: 'geplante Trainings verpasst · letzte 4 Wochen', asc: true, val: (st) => (typeof st.m4 === 'number' ? st.m4 : null) },
  sets: { label: 'Ausgelassen', unit: 'der Sätze', sub: 'übersprungene Sätze/Übungen · letzte 4 Wochen', asc: true, val: (st) => (st.t4 ? Math.round((st.k4 / st.t4) * 100) : typeof st.t4 === 'number' ? 0 : null) },
};

/** Rangliste inkl. mir. Einträge ohne Wert stehen unten. */
export function leaderboard(key) {
  const b = BOARDS[key];
  const me = { id: data.profile.id, name: data.profile.name || 'Du', me: true, t: Date.now(), stats: myStats() };
  return [me, ...data.friends]
    .map((p) => ({ ...p, value: b.val(p.stats) }))
    .sort((a, c) => {
      if (a.value == null || c.value == null) return (a.value == null) - (c.value == null); // ohne Wert nach unten
      return b.asc ? a.value - c.value : c.value - a.value;
    });
}
