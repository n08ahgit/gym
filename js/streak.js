// =============================================================
// streak.js – Tages-Streak, Streak-Schutz, Flamme, Feier
//
// Regeln:
// - Ein Tag zählt, wenn der Plan eingehalten wurde: Training an einem
//   Trainingstag, ein Pausetag laut Plan oder ein Extra-Training.
// - Heute (Trainingstag, noch nicht trainiert) bricht die Streak nicht –
//   die Flamme glimmt nur, bis das Workout gespeichert ist.
// - Alle 7 Streak-Tage gibt es einen Schutz (max. 2). Ein verpasster
//   Trainingstag verbraucht automatisch einen Schutz statt die Streak.
// Alles wird aus den gespeicherten Daten berechnet – nichts extra gespeichert
// außer "zuletzt gefeierte Streak" (damit die Feier nicht doppelt kommt).
// =============================================================

import { data } from './store.js';
import { addDays, dateStr, parseDate, weekdayIdx, WD_SHORT } from './util.js';
import { dayStatus } from './year.js';
import { sessionsByDate } from './store.js';

export const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365, 500, 1000];
const MAX_FREEZES = 2;

export const TIERS = [
  { min: 0, name: 'Glut' },
  { min: 1, name: 'Funke' },
  { min: 7, name: 'Flamme' },
  { min: 30, name: 'Feuer' },
  { min: 100, name: 'Inferno' },
];
export const tierOf = (n) => TIERS.reduce((t, x, i) => (n >= x.min ? i : t), 0);

/** Streak bis einschließlich heute berechnen. */
export function computeStreak(today = new Date()) {
  const todayStr = dateStr(today);
  const byDate = sessionsByDate();
  const firstDates = [...data.planVersions.map((v) => v.from), ...data.sessions.map((s) => s.date)].sort();
  const result = { current: 0, best: 0, freezes: 0, todayState: 'none', days: new Map() };
  if (!firstDates.length) return withExtras(result, today);

  let streak = 0, best = 0, freezes = 0;
  for (let d = parseDate(firstDates[0]); dateStr(d) < todayStr; d = addDays(d, 1)) {
    const ds = dateStr(d);
    const st = dayStatus(ds, todayStr, byDate);
    if (st === 'done' || st === 'rest') {
      streak++;
      if (streak % 7 === 0 && freezes < MAX_FREEZES) freezes++;
      result.days.set(ds, st);
    } else if (st === 'missed') {
      if (freezes > 0) { freezes--; result.days.set(ds, 'frozen'); }
      else { streak = 0; result.days.set(ds, 'missed'); }
    }
    best = Math.max(best, streak);
  }
  // Heute
  const st = dayStatus(todayStr, todayStr, byDate);
  if (st === 'done' || st === 'rest') {
    streak++;
    if (streak % 7 === 0 && freezes < MAX_FREEZES) freezes++;
    result.todayState = st;
  } else if (st === 'open') result.todayState = 'pending';
  result.days.set(todayStr, result.todayState === 'pending' ? 'pending' : st);
  result.current = streak;
  result.best = Math.max(best, streak);
  result.freezes = freezes;
  return withExtras(result, today);
}

function withExtras(r, today) {
  const next = MILESTONES.find((m) => m > r.current) || r.current + 100;
  const prev = [...MILESTONES].reverse().find((m) => m <= r.current) || 0;
  r.next = next;
  r.progress = (r.current - prev) / (next - prev);
  r.tier = tierOf(r.current);
  // aktuelle Woche Mo–So
  const mon = addDays(today, -weekdayIdx(today));
  r.week = Array.from({ length: 7 }, (_, i) => {
    const ds = dateStr(addDays(mon, i));
    return { label: WD_SHORT[i], ds, state: ds > dateStr(today) ? 'future' : r.days.get(ds) || 'none' };
  });
  return r;
}

// ---------- Flamme ----------
// Bilder (mit dem OpenAI-Bildmodell erzeugt, transparenter Hintergrund):
// orange = Funke/Flamme, rot = Feuer, blau = Inferno. "dim" (heute offen /
// keine Streak) macht sie per CSS grau. Animation: leichtes "Atmen" (CSS).

const FLAME_IMG = ['orange', 'orange', 'orange', 'red', 'blue'];

export function flameSvg(tier, { size = 96, dim = false } = {}) {
  const sparks = tier >= 3 && !dim ? '<i class="spark s0"></i><i class="spark s1"></i><i class="spark s2"></i>' : '';
  return `<span class="flame t${tier}${dim ? ' dim' : ''}" style="width:${size}px;height:${size}px" aria-hidden="true">
    ${sparks}<img src="img/flame/${FLAME_IMG[tier]}.webp" alt="" width="${size}" height="${size}" decoding="async"></span>`;
}

/** Kleine Flamme für Wochenpunkte (ohne Animation). */
export function miniFlame(tier = 2, size = 16) {
  return `<img class="flame-mini" src="img/flame/${FLAME_IMG[Math.max(1, tier)]}.webp" alt="" width="${size}" height="${size}">`;
}

// ---------- Feier nach dem Speichern ----------

const CELEBRATED_KEY = 'gym.streakCelebrated';

/** Liefert Daten für die Feier, falls die Streak heute gestiegen ist (und noch nicht gefeiert wurde). */
export function celebrationFor(before, after) {
  if (after.current <= before.current) return null;
  const key = `${dateStr()}:${after.current}`;
  try {
    if (localStorage.getItem(CELEBRATED_KEY) === key) return null;
    localStorage.setItem(CELEBRATED_KEY, key);
  } catch { /* egal */ }
  const milestone = MILESTONES.includes(after.current) ? after.current : null;
  const newTier = after.tier > before.tier ? TIERS[after.tier].name : null;
  const newFreeze = after.freezes > before.freezes;
  return { from: before.current, to: after.current, milestone, newTier, newFreeze, tier: after.tier, next: after.next };
}
