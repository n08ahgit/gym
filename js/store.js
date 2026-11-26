// =============================================================
// store.js – Datenhaltung (localStorage)
//
// Datenmodell (Schlüssel "gym.data.v1"):
// {
//   schema: 1,
//   planVersions: [            // aufsteigend nach "from" sortiert
//     { from: "2026-11-24",    // gilt ab diesem Tag (bis zur nächsten Version)
//       days: [                // Index 0 = Montag … 6 = Sonntag
//         { name: "Torso", exercises: [ { exId, name, sets: 4, rest: 180 } ] },
//         null,                // null = Pausetag
//         …
//       ] }
//   ],
//   customExercises: [ { id: "c_…", name, primary: ["chest"], secondary: [] } ],
//   sessions: [                // gespeicherte Workouts
//     { id, date: "2026-11-24", start: ms, end: ms, dayIdx, workoutName,
//       exercises: [ { exId, name, planned: 4,
//                      sets: [ { w: 80, r: 8, status: "done" | "skipped" } ] } ] }
//   ],
//   body: [ { date: "2026-11-24", kg: 75.2 } ],       // Körpergewicht, 1 Wert pro Tag
//   profile: { id, name, code: "K7Q2MX", key },      // Code = kurzer Freundes-Code, key = geheim
//   friends: [ { id, name, t: ms, stats: {…} } ],     // zuletzt erhaltener Stand
//   drinks: [ { id, t, date, key, name, ml, mg } ],  // Energy-Drinks / Koffein
//   settings: { bar: 20, removed: [codes] }           // Stangengewicht, entfernte Freunde
// }
//
// Laufendes Workout separat unter "gym.active.v1" (siehe workout.js).
//
// Warum Plan-Versionen? Ändert man den Plan, dürfen vergangene Tage in der
// Jahresübersicht nicht umgefärbt werden. Für jeden Tag gilt die letzte
// Version mit from <= Tag.
// =============================================================

import { dateStr, clone, uid } from './util.js';

const DATA_KEY = 'gym.data.v1';
const ACTIVE_KEY = 'gym.active.v1';
export const SCHEMA = 1;

function emptyData() {
  return { schema: SCHEMA, planVersions: [], customExercises: [], sessions: [], body: [], profile: { id: uid(), name: '' }, friends: [], drinks: [], settings: { bar: 20 } };
}

/** Bringt (auch importierte) Daten in eine saubere, gültige Form. */
export function normalize(d) {
  const out = emptyData();
  if (!d || typeof d !== 'object') return out;
  if (Array.isArray(d.planVersions)) {
    out.planVersions = d.planVersions
      .filter((v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v.from) && Array.isArray(v.days) && v.days.length === 7)
      .map((v) => ({ from: v.from, days: v.days.map((w) => (w && Array.isArray(w.exercises) ? w : null)) }))
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  }
  if (Array.isArray(d.customExercises)) {
    out.customExercises = d.customExercises.filter((e) => e && e.id && e.name && Array.isArray(e.primary));
  }
  if (Array.isArray(d.sessions)) {
    out.sessions = d.sessions
      .filter((s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && Array.isArray(s.exercises))
      .sort((a, b) => (a.start || 0) - (b.start || 0));
  }
  if (Array.isArray(d.body)) {
    const byDay = new Map();
    for (const b of d.body) if (b && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.kg > 20 && b.kg < 400) byDay.set(b.date, { date: b.date, kg: +b.kg });
    out.body = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  if (d.profile && typeof d.profile.id === 'string') {
    out.profile = { id: d.profile.id, name: String(d.profile.name || '').slice(0, 24) };
    if (/^[A-Z2-9]{6}$/.test(d.profile.code || '') && typeof d.profile.key === 'string') { out.profile.code = d.profile.code; out.profile.key = d.profile.key; }
  }
  if (Array.isArray(d.friends)) out.friends = d.friends.filter((f) => f && f.id && f.name && f.stats && f.id !== out.profile.id);
  if (Array.isArray(d.drinks)) out.drinks = d.drinks.filter((x) => x && x.id && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.mg >= 0 && x.mg < 2000);
  if (d.settings && typeof d.settings === 'object') out.settings = { ...out.settings, ...d.settings };
  return out;
}

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const d = normalize(parsed);
    // Ältere Daten ohne Profil: neue Kennung sofort festschreiben (sonst wechselt sie bei jedem Start)
    if (!parsed.profile) localStorage.setItem(DATA_KEY, JSON.stringify(d));
    return d;
  } catch (e) {
    console.error('Daten konnten nicht geladen werden', e);
    return emptyData();
  }
}

/** Live-Daten. Andere Module lesen "data" direkt (ES-Module = Live-Binding). */
export let data = loadData();

export function save() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error(e);
    alert('Speichern fehlgeschlagen (Speicher voll?). Bitte in den Einstellungen exportieren.');
    return false;
  }
}

// ---------- Trainingsplan ----------

/** Aktueller Plan (Kopie): Array mit 7 Einträgen (Workout oder null). */
export function currentPlan() {
  const v = data.planVersions[data.planVersions.length - 1];
  return v ? clone(v.days) : Array(7).fill(null);
}

/** Plan-Version, die an einem Tag galt (oder null, wenn es noch keinen Plan gab). */
export function planVersionFor(ds) {
  let res = null;
  for (const v of data.planVersions) {
    if (v.from <= ds) res = v;
    else break;
  }
  return res;
}

/** Workout eines Wochentags im aktuellen Plan setzen (null = Pausetag). */
export function setPlanDay(idx, workout) {
  const days = currentPlan();
  days[idx] = workout ? clone(workout) : null;
  commitPlan(days);
}

/** Mehrere Wochentage auf einmal setzen: { 2: workout, 4: workout } (eine Plan-Version). */
export function setPlanDays(map) {
  const days = currentPlan();
  for (const [i, w] of Object.entries(map)) days[+i] = w ? clone(w) : null;
  commitPlan(days);
}

/**
 * Neue Plan-Version speichern. Gab es heute schon eine Version, wird sie
 * überschrieben (mehrere Änderungen am selben Tag = eine Version).
 */
function commitPlan(days) {
  const today = dateStr();
  const last = data.planVersions[data.planVersions.length - 1];
  if (last && JSON.stringify(last.days) === JSON.stringify(days)) return;
  if (last && last.from >= today) last.days = days;
  else data.planVersions.push({ from: today, days });
  save();
}

// ---------- Sessions (gespeicherte Workouts) ----------

export function addSession(s) {
  data.sessions.push(s);
  data.sessions.sort((a, b) => a.start - b.start);
  save();
}

export function sessionsByDate() {
  const m = new Map();
  for (const s of data.sessions) {
    if (!m.has(s.date)) m.set(s.date, []);
    m.get(s.date).push(s);
  }
  return m;
}

/**
 * Erledigte Sätze dieser Übung aus dem letzten Training, in dem sie
 * mindestens einmal gemacht wurde. Sonst null.
 */
export function lastDoneSets(exId) {
  for (let i = data.sessions.length - 1; i >= 0; i--) {
    const ex = data.sessions[i].exercises.find((e) => e.exId === exId);
    if (!ex) continue;
    const done = ex.sets.filter((s) => s.status === 'done');
    if (done.length) return done;
  }
  return null;
}

// ---------- Körpergewicht ----------

/** Gewicht für einen Tag setzen (überschreibt denselben Tag). */
export function setBodyWeight(ds, kg) {
  data.body = data.body.filter((b) => b.date !== ds);
  if (kg) data.body.push({ date: ds, kg });
  data.body.sort((a, b) => (a.date < b.date ? -1 : 1));
  save();
}

// ---------- Eigene Übungen ----------

export function addCustomExercise(ex) {
  data.customExercises.push(ex);
  save();
}

export function removeCustomExercise(id) {
  data.customExercises = data.customExercises.filter((e) => e.id !== id);
  save();
}

// ---------- Laufendes Workout ----------

export function loadActive() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActive(a) {
  if (a) localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
  else localStorage.removeItem(ACTIVE_KEY);
}

// ---------- Export / Import ----------

export function exportJSON() {
  return JSON.stringify({ app: 'gym-tracker', exportedAt: new Date().toISOString(), data, active: loadActive() }, null, 2);
}

/** Import: ersetzt alle Daten. Wirft Fehler bei ungültiger Datei. */
export function importJSON(text) {
  const parsed = JSON.parse(text);
  const src = parsed && parsed.data ? parsed.data : parsed;
  if (!src || !Array.isArray(src.planVersions) || !Array.isArray(src.sessions)) {
    throw new Error('Keine gültige Backup-Datei.');
  }
  const keepProfile = data.profile;
  data = normalize(src);
  if (!src.profile) data.profile = keepProfile;
  save();
  saveActive(parsed.active && Array.isArray(parsed.active.items) ? parsed.active : null);
}

export function wipeAll() {
  const keep = data.profile;
  data = emptyData();
  data.profile = keep;
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}
