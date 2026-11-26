// =============================================================
// stats.js – Auswertungen für den Fortschritt-Tab (reine Berechnung,
// kein DOM). Alles wird aus data.sessions + Plan-Versionen abgeleitet.
// =============================================================

import { data, planVersionFor, plannedOf } from './store.js';
import { addDays, dateStr, parseDate, weekdayIdx, setVol } from './util.js';
import { getExercise } from './exercises.js';

/** Geschätztes 1-Wiederholungs-Maximum (Epley). Nur bis 12 Wdh sinnvoll. */
export function e1rm(w, r) {
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + Math.min(r, 12) / 30);
}

/** Zeiträume für den Umschalter. */
export const RANGES = {
  '4w': { label: '4 Wochen', weeks: 4 },
  '3m': { label: '3 Monate', weeks: 13 },
  '1y': { label: 'Jahr', weeks: 52 },
};

const doneSets = (ex) => ex.sets.filter((s) => s.status === 'done');

/** Montag der Woche eines Datums. */
function monday(d) {
  return addDays(d, -weekdayIdx(d));
}

/** Sessions im Zeitraum [from, to] (Datums-Strings). */
function sessionsBetween(from, to) {
  return data.sessions.filter((s) => s.date >= from && s.date <= to);
}

/** Anzahl geplanter Trainingstage zwischen from und to (laut damals gültigem Plan). */
function plannedBetween(from, to) {
  let n = 0;
  for (let d = parseDate(from); dateStr(d) <= to; d = addDays(d, 1)) {
    const ds = dateStr(d);
    if (plannedOf(planVersionFor(ds), ds)) n++;
  }
  return n;
}

function summarize(list) {
  let sets = 0, volume = 0, dur = 0;
  for (const s of list) {
    dur += s.end - s.start;
    for (const ex of s.exercises) {
      for (const st of doneSets(ex)) {
        sets++;
        volume += setVol(st);
      }
    }
  }
  return { count: list.length, sets, volume, avgDuration: list.length ? dur / list.length : 0 };
}

/**
 * Kennzahlen für den Zeitraum + Vergleich mit dem gleich langen Zeitraum davor.
 */
export function overview(rangeKey, today = new Date()) {
  const weeks = RANGES[rangeKey].weeks;
  const to = dateStr(today);
  const from = dateStr(addDays(monday(today), -(weeks - 1) * 7));
  const prevTo = dateStr(addDays(parseDate(from), -1));
  const prevFrom = dateStr(addDays(parseDate(from), -weeks * 7));
  const cur = summarize(sessionsBetween(from, to));
  const prev = summarize(sessionsBetween(prevFrom, prevTo));
  const planned = plannedBetween(from, to);
  return { from, to, cur, prev, planned, adherence: planned ? Math.min(1, cur.count / planned) : null };
}

/** Pro Woche: erledigte und geplante Trainings (älteste zuerst). */
export function weekly(rangeKey, today = new Date()) {
  const weeks = RANGES[rangeKey].weeks;
  const out = [];
  const todayStr = dateStr(today);
  for (let i = weeks - 1; i >= 0; i--) {
    const mon = addDays(monday(today), -i * 7);
    const from = dateStr(mon);
    const sun = dateStr(addDays(mon, 6));
    const to = sun < todayStr ? sun : todayStr;
    const list = sessionsBetween(from, sun);
    out.push({ from, done: list.length, planned: plannedBetween(from, to), volume: summarize(list).volume, current: i === 0 });
  }
  return out;
}

/**
 * Kraftverlauf je Übung: pro Training der beste geschätzte 1RM-Wert.
 * Rückgabe sortiert nach Häufigkeit im Zeitraum.
 */
export function strength(rangeKey, today = new Date()) {
  const { from } = overview(rangeKey, today);
  const map = new Map();
  for (const s of data.sessions) {
    for (const ex of s.exercises) {
      const sets = doneSets(ex).filter((x) => x.w && x.r);
      if (!sets.length) continue;
      const best = sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a));
      if (!map.has(ex.exId)) map.set(ex.exId, { exId: ex.exId, name: getExercise(ex.exId)?.name || ex.name, points: [] });
      map.get(ex.exId).points.push({ date: s.date, value: e1rm(best.w, best.r), w: best.w, r: best.r });
    }
  }
  const res = [];
  for (const e of map.values()) {
    const inRange = e.points.filter((p) => p.date >= from);
    if (!inRange.length) continue;
    const first = inRange[0].value, last = inRange[inRange.length - 1].value;
    const best = Math.max(...e.points.map((p) => p.value));
    res.push({ ...e, inRange, first, last, best, change: last - first });
  }
  return res.sort((a, b) => b.inRange.length - a.inRange.length || a.name.localeCompare(b.name, 'de'));
}

/** Alle Daten einer Übung (für die Detailansicht). */
export function exerciseHistory(exId) {
  const rows = [];
  for (const s of data.sessions) {
    const ex = s.exercises.find((e) => e.exId === exId);
    if (!ex) continue;
    const sets = doneSets(ex);
    if (!sets.length) continue;
    const valid = sets.filter((x) => x.w && x.r);
    const best = valid.length ? valid.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a)) : null;
    rows.push({ date: s.date, sets, best, value: best ? e1rm(best.w, best.r) : 0, volume: sets.reduce((n, x) => n + setVol(x), 0) });
  }
  return rows;
}

/**
 * Sätze pro Muskelgruppe im Zeitraum (Hauptmuskel 1, Hilfsmuskel 0,5).
 */
export function muscleSets(rangeKey, today = new Date()) {
  const { from, to } = overview(rangeKey, today);
  const tally = {};
  for (const s of sessionsBetween(from, to)) {
    for (const ex of s.exercises) {
      const def = getExercise(ex.exId);
      if (!def) continue;
      const n = doneSets(ex).length;
      if (!n) continue;
      for (const k of def.primary) tally[k] = (tally[k] || 0) + n;
      for (const k of def.secondary || []) tally[k] = (tally[k] || 0) + n * 0.5;
    }
  }
  return tally;
}

/** Rekorde: Trainings, in denen eine Übung einen neuen Bestwert (1RM) erreicht hat. Neueste zuerst. */
export function records(limit = 6) {
  const best = new Map();
  const out = [];
  for (const s of data.sessions) {
    for (const ex of s.exercises) {
      for (const st of doneSets(ex)) {
        if (!st.w || !st.r) continue;
        const v = e1rm(st.w, st.r);
        const prev = best.get(ex.exId);
        if (prev === undefined || v > prev + 0.01) {
          if (prev !== undefined) out.push({ date: s.date, exId: ex.exId, name: getExercise(ex.exId)?.name || ex.name, w: st.w, r: st.r, value: v, gain: v - prev });
          best.set(ex.exId, v);
        }
      }
    }
  }
  // pro Übung und Tag nur den höchsten Rekord
  const seen = new Set();
  return out.reverse().filter((x) => {
    const key = x.exId + x.date;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

/** Serie: wie viele Wochen in Folge (bis zur letzten abgeschlossenen) der Plan erfüllt wurde. */
export function streakWeeks(today = new Date()) {
  let n = 0;
  for (let i = 1; i < 200; i++) {
    const mon = addDays(monday(today), -i * 7);
    const from = dateStr(mon), to = dateStr(addDays(mon, 6));
    const planned = plannedBetween(from, to);
    if (!planned) break;
    if (sessionsBetween(from, to).length >= planned) n++;
    else break;
  }
  // laufende Woche zählt mit, wenn sie schon erfüllt ist
  const from = dateStr(monday(today));
  const planned = plannedBetween(from, dateStr(addDays(monday(today), 6)));
  if (planned && sessionsBetween(from, dateStr(today)).length >= planned) n++;
  return n;
}

/**
 * "Gut zu wissen": Werte über die gesamte Zeit, eher zum Staunen als zum Steuern.
 */
export function funFacts() {
  const s = data.sessions;
  if (!s.length) return null;
  let volume = 0, reps = 0, ms = 0;
  const setsPer = new Map(), weekdays = Array(7).fill(0), hours = [];
  let strongest = null;
  for (const x of s) {
    ms += x.end - x.start;
    weekdays[x.dayIdx ?? weekdayIdx(parseDate(x.date))]++;
    hours.push(new Date(x.start).getHours() + new Date(x.start).getMinutes() / 60);
    for (const ex of x.exercises) {
      for (const st of doneSets(ex)) {
        setsPer.set(ex.exId, (setsPer.get(ex.exId) || 0) + 1);
        reps += st.r || 0;
        if (st.w && st.r) {
          volume += setVol(st);
          const v = e1rm(st.w, st.r);
          if (!strongest || v > strongest.value) strongest = { exId: ex.exId, name: getExercise(ex.exId)?.name || ex.name, value: v, w: st.w, r: st.r };
        }
      }
    }
  }
  const fav = [...setsPer.entries()].sort((a, b) => b[1] - a[1])[0];
  // längste Serie: Wochen in Folge mit Plan erfüllt
  let best = 0, cur = 0;
  const first = monday(parseDate(s[0].date));
  for (let mon = first; mon <= new Date(); mon = addDays(mon, 7)) {
    const from = dateStr(mon), to = dateStr(addDays(mon, 6));
    const planned = plannedBetween(from, to);
    if (!planned) continue;
    if (sessionsBetween(from, to).length >= planned) best = Math.max(best, ++cur);
    else if (to < dateStr(new Date())) cur = 0;
  }
  const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
  return {
    volume, reps, hours: ms / 3600000, count: s.length, since: s[0].date,
    favorite: fav ? { name: getExercise(fav[0])?.name || fav[0], sets: fav[1] } : null,
    strongest, longestStreak: best,
    topWeekday: weekdays.indexOf(Math.max(...weekdays)),
    avgStart: `${Math.floor(avgHour)}:${String(Math.round((avgHour % 1) * 60)).padStart(2, '0')}`,
  };
}
