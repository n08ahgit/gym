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
//   food: [ { id, t, date, name, g, kcal, p, c, f, ref } ], // Kalorien-Tracker
//   water: [ { id, t, date, ml } ],
//   meals: [ { id, name, servings, items: [ { food (Werte je 100 g), g } ] } ],  // eigene Gerichte
//   myFoods: [ { id: 'u:…', name, kcal, p, c, f, fib, sug, sat, portion, unit, cat, liquid?, code? } ], // eigene Lebensmittel (je 100 g)
//   supps: [ { id, name, dose, time: 'HH:MM', rep: { type: 'daily'|'days'|'every'|'once', days, n, start }, hint, nag } ],
//   suppDone: { 'YYYY-MM-DD': [ids] },             // abgehakte Supplements
//   nutrition: { sex, age, height, weight, bodyFat?, job, steps?, trainDays, trainMin, sport, sportHours, level, goal, targetWeight?, targetDate?, kcal?, adjust? },
//   settings: { bar: 20, unit: 'kg'|'lb', exUnit: { exId: 'kg'|'lb' }, removed: [codes] }
//   Sätze speichern w immer in kg, dazu u = Einheit, in der eingegeben wurde.           // Stangengewicht, entfernte Freunde
// }
//
// Laufendes Workout separat unter "gym.active.v1" (siehe workout.js).
//
// Warum Plan-Versionen? Ändert man den Plan, dürfen vergangene Tage in der
// Jahresübersicht nicht umgefärbt werden. Für jeden Tag gilt die letzte
// Version mit from <= Tag.
// =============================================================

import { dateStr, clone, uid, parseDate, weekdayIdx, WEEKDAYS, units } from './util.js';

const validCycle = (c) => !!c && /^\d{4}-\d{2}-\d{2}$/.test(c.start);

const DATA_KEY = 'gym.data.v1';
const ACTIVE_KEY = 'gym.active.v1';
export const SCHEMA = 1;

function emptyData() {
  return { schema: SCHEMA, planVersions: [], customExercises: [], sessions: [], body: [], profile: { id: uid(), name: '' }, friends: [], drinks: [], food: [], water: [], meals: [], myFoods: [], myDrinks: [], drinkNutr: {}, supps: [], suppDone: {}, nutrition: {}, settings: { bar: 20 } };
}

/** Bringt (auch importierte) Daten in eine saubere, gültige Form. */
export function normalize(d) {
  const out = emptyData();
  if (!d || typeof d !== 'object') return out;
  if (Array.isArray(d.planVersions)) {
    out.planVersions = d.planVersions
      .filter((v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v.from) && Array.isArray(v.days)
        && (validCycle(v.cycle) ? v.days.length >= 2 && v.days.length <= 14 : v.days.length === 7))
      .map((v) => ({ from: v.from, days: v.days.map((w) => (w && Array.isArray(w.exercises) ? w : null)), ...(validCycle(v.cycle) ? { cycle: { start: v.cycle.start } } : {}) }))
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
  if (Array.isArray(d.food)) out.food = d.food.filter((x) => x && x.id && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.kcal >= 0 && x.kcal < 20000);
  if (Array.isArray(d.meals)) out.meals = d.meals.filter((m) => m && m.id && m.name && Array.isArray(m.items) && m.items.length);
  if (d.drinkNutr && typeof d.drinkNutr === 'object') out.drinkNutr = d.drinkNutr;
  if (Array.isArray(d.myDrinks)) out.myDrinks = d.myDrinks.filter((x) => x && /^\d{8,14}$/.test(x.code || '') && x.name && x.mg >= 0 && x.mg <= 1000).slice(0, 200);
  if (Array.isArray(d.myFoods)) out.myFoods = d.myFoods.filter((x) => x && x.id && x.name && x.kcal >= 0 && x.kcal <= 950).slice(0, 500);
  if (Array.isArray(d.supps)) out.supps = d.supps.filter((x) => x && x.id && x.name && /^\d{2}:\d{2}$/.test(x.time)).slice(0, 30);
  if (d.suppDone && typeof d.suppDone === 'object') {
    // nur die letzten 60 Tage behalten
    const cut = dateStr(new Date(Date.now() - 60 * 864e5));
    for (const [k, v] of Object.entries(d.suppDone)) if (k >= cut && Array.isArray(v)) out.suppDone[k] = v;
  }
  if (Array.isArray(d.water)) out.water = d.water.filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.ml > 0 && x.ml < 5000);
  if (d.nutrition && typeof d.nutrition === 'object') out.nutrition = { ...d.nutrition };
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
units.w = data.settings.unit === 'lb' ? 'lb' : 'kg';

/** Einheit einer Übung (pro Übung wählbar, z. B. Kabelturm in lb), sonst Standard. */
export const exUnit = (exId) => data.settings.exUnit?.[exId] || units.w;
export function setExUnit(exId, u) {
  data.settings.exUnit = { ...(data.settings.exUnit || {}), [exId]: u === 'lb' ? 'lb' : 'kg' };
  save();
}

/** Gewichtseinheit umstellen (Anzeige/Eingabe; gespeichert wird weiter in kg). */
export function setWeightUnit(u) {
  data.settings.unit = u === 'lb' ? 'lb' : 'kg';
  units.w = data.settings.unit;
  save();
}

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

// Zwei Plan-Arten:
//   Wochenplan  – days[0..6] = Mo..So
//   Rhythmus    – days[0..n-1] wiederholen sich ab cycle.start im Kreis
//                 (z. B. Push, Pull, Legs, Pause), unabhängig vom Wochentag.

/** Aktuelle Plan-Version (Original, nicht verändern) oder null. */
export const currentVersion = () => data.planVersions[data.planVersions.length - 1] || null;

/** Aktueller Plan (Kopie): Array mit 7 (Woche) bzw. n (Rhythmus) Einträgen. */
export function currentPlan() {
  const v = currentVersion();
  return v ? clone(v.days) : Array(7).fill(null);
}

/** Rhythmus des aktuellen Plans ({ start }) oder null bei Wochenplan. */
export const currentCycle = () => currentVersion()?.cycle || null;

/** Ganze Tage zwischen zwei Datums-Strings (sommerzeitsicher). */
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

/** Index im Plan, der an Tag ds gilt (Wochentag bzw. Stelle im Rhythmus). */
export function planIndex(v, ds) {
  if (v?.cycle) {
    const n = v.days.length;
    return ((daysBetween(v.cycle.start, ds) % n) + n) % n;
  }
  return weekdayIdx(parseDate(ds));
}

/** Geplantes Workout an Tag ds laut Version v (null = Pausetag). */
export const plannedOf = (v, ds) => (v ? v.days[planIndex(v, ds)] : null);

/** Bezeichnung eines Plan-Tags: "Montag" bzw. "Tag 2". */
export const dayLabel = (idx, cycle = currentCycle()) => (cycle ? `Tag ${idx + 1}` : WEEKDAYS[idx]);

/** Plan-Version, die an einem Tag galt (oder null, wenn es noch keinen Plan gab). */
export function planVersionFor(ds) {
  let res = null;
  for (const v of data.planVersions) {
    if (v.from <= ds) res = v;
    else break;
  }
  return res;
}

/** Rhythmus starten/ändern: days = Workouts im Kreis, todayIdx = welcher Tag heute ist. */
export function setPlanCycle(days, todayIdx = 0) {
  // Start so wählen, dass heute = todayIdx ist (setDate = sommerzeitsicher)
  const d = parseDate(dateStr());
  d.setDate(d.getDate() - (todayIdx % days.length));
  commitPlan(days.map((w) => (w ? clone(w) : null)), { start: dateStr(d) });
}

/** Zurück zum Wochenplan (days = 7 Einträge Mo..So). */
export function setPlanWeekly(days) {
  commitPlan(days.map((w) => (w ? clone(w) : null)), null);
}

/** Workout eines Tages im aktuellen Plan setzen (null = Pausetag). */
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
function commitPlan(days, cycle = currentCycle()) {
  const today = dateStr();
  const last = currentVersion();
  const c = cycle ? { start: cycle.start } : undefined;
  if (last && JSON.stringify(last.days) === JSON.stringify(days) && JSON.stringify(last.cycle) === JSON.stringify(c)) return;
  if (last && last.from >= today) {
    last.days = days;
    if (c) last.cycle = c; else delete last.cycle;
  } else data.planVersions.push({ from: today, days, ...(c ? { cycle: c } : {}) });
  save();
}

// ---------- Sessions (gespeicherte Workouts) ----------

export function addSession(s) {
  data.sessions.push(s);
  data.sessions.sort((a, b) => a.start - b.start);
  save();
}

/** Gespeichertes Workout ändern (z. B. Tippfehler) bzw. löschen. */
export function updateSession(id, fn) {
  const s = data.sessions.find((x) => x.id === id);
  if (!s) return null;
  fn(s);
  data.sessions.sort((a, b) => a.start - b.start);
  save();
  return s;
}
export function deleteSession(id) {
  data.sessions = data.sessions.filter((x) => x.id !== id);
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
  units.w = data.settings.unit === 'lb' ? 'lb' : 'kg';
  save();
  saveActive(parsed.active && Array.isArray(parsed.active.items) ? parsed.active : null);
}

/**
 * Training neu starten: Workouts weg (damit Rekorde, Streak, Jahresansicht,
 * Kraftverlauf), Plan bleibt – gilt ab heute, damit alte Tage nicht als
 * „verpasst“ zählen. Alles andere (Freunde, Ernährung, Supplements,
 * Körpergewicht, eigene Übungen) bleibt.
 */
export function resetTraining() {
  const cur = currentVersion();
  data.sessions = [];
  data.planVersions = cur ? [{ ...clone(cur), from: dateStr() }] : [];
  localStorage.removeItem(ACTIVE_KEY);
  save();
}

export function wipeAll() {
  const keep = data.profile;
  data = emptyData();
  data.profile = keep;
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}
