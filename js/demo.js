// =============================================================
// demo.js – Beispieldaten zum Ausprobieren (nur in demo.html aktiv)
//
// Erzeugt relativ zum heutigen Tag:
// - Plan-Version 1 (vor 16 Wochen): Mo Torso, Di Limbs, Do Torso, Fr Limbs
// - Plan-Version 2 (vor 5 Wochen): zusätzlich Sa "Arme & Bauch"
//   → zeigt, dass alte Tage nach einer Planänderung gleich bleiben
// - ~16 Wochen Trainings mit langsam steigenden Gewichten, einige
//   verpasste Tage, einzelne übersprungene Sätze, eine eigene Übung
// =============================================================

import { addDays, dateStr, weekdayIdx } from './util.js';

export function buildDemoData(today = new Date()) {
  const ex = (exId, name, sets = 3, rest = 150) => ({ exId, name, sets, rest });
  const torso = { name: 'Torso', exercises: [
    ex('bench_press', 'Bankdrücken', 4, 180), ex('lat_pulldown', 'Latzug'), ex('ohp', 'Schulterdrücken Langhantel'),
    ex('c_demo_row', 'Kabelrudern einarmig'), ex('lateral_raise', 'Seitheben', 3, 90), ex('pushdown', 'Trizepsdrücken am Kabel', 3, 90),
  ] };
  const limbs = { name: 'Limbs', exercises: [
    ex('squat', 'Kniebeuge', 4, 180), ex('deadlift', 'Kreuzheben', 3, 180), ex('leg_ext', 'Beinstrecker', 3, 90),
    ex('leg_curl_seated', 'Beinbeuger sitzend', 3, 90), ex('standing_calf', 'Wadenheben stehend', 3, 60), ex('db_curl', 'Kurzhantel-Curls', 3, 90),
  ] };
  const arms = { name: 'Arme & Bauch', exercises: [
    ex('hammer_curl', 'Hammer Curls', 3, 90), ex('skullcrusher', 'French Press', 3, 90), ex('cable_crunch', 'Kabel-Crunches', 3, 60), ex('hanging_leg_raise', 'Hängendes Beinheben', 3, 60),
  ] };
  const v1 = [torso, limbs, null, torso, limbs, null, null];
  const v2 = [torso, limbs, null, torso, limbs, arms, null];

  const start = addDays(today, -7 * 16 - weekdayIdx(today));
  const switchDay = addDays(today, -7 * 5 - weekdayIdx(today));
  const base = {
    bench_press: 70, lat_pulldown: 55, ohp: 40, c_demo_row: 22.5, lateral_raise: 8, pushdown: 25,
    squat: 85, deadlift: 105, leg_ext: 45, leg_curl_seated: 40, standing_calf: 60, db_curl: 12,
    hammer_curl: 14, skullcrusher: 25, cable_crunch: 35, hanging_leg_raise: 0,
  };

  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const sessions = [];
  let n = 0;
  for (let d = new Date(start); dateStr(d) < dateStr(today); d = addDays(d, 1)) {
    const plan = d < switchDay ? v1 : v2;
    const w = plan[weekdayIdx(d)];
    if (!w) continue;
    if (rnd() < 0.1) continue; // verpasst
    n++;
    const startTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, Math.floor(rnd() * 50)).getTime();
    const exercises = w.exercises.map((e) => {
      const kg = Math.round(base[e.exId] * (1 + n * 0.005) * 2) / 2;
      const skipAll = rnd() < 0.03;
      return {
        exId: e.exId, name: e.name, planned: e.sets,
        sets: Array.from({ length: e.sets }, (_, i) => {
          if (skipAll || (i === e.sets - 1 && rnd() < 0.08)) return { w: null, r: null, status: 'skipped' };
          const reps = e.exId === 'hanging_leg_raise' ? 12 : Math.max(5, 9 - i + (rnd() > 0.7 ? 1 : 0));
          return { w: e.exId === 'hanging_leg_raise' ? null : kg, r: reps, status: 'done' };
        }),
      };
    });
    sessions.push({ id: 'demo' + n, date: dateStr(d), start: startTs, end: startTs + (2900 + rnd() * 1200) * 1000, dayIdx: weekdayIdx(d), workoutName: w.name, exercises });
  }

  // Körpergewicht: ~5 Messungen pro Woche, langsamer sauberer Aufbau (≈ +0,25 %/Woche)
  const body = [];
  for (let d = new Date(start), i = 0; dateStr(d) <= dateStr(today); d = addDays(d, 1), i++) {
    if (rnd() < 0.3) continue;
    body.push({ date: dateStr(d), kg: Math.round((72.2 + i * 0.027 + (rnd() - 0.5) * 0.9) * 10) / 10 });
  }
  const t = (days) => today.getTime() - days * 864e5;
  const friends = [
    { id: 'demo-lena', name: 'Lena', t: t(1), stats: { s: 41, b: 58, w4: 15, v4: 61200, x4: 248, e: { bench_press: 62.5, squat: 105, deadlift: 125 }, bw: 63.4, m4: 1, p4: 16, k4: 4, t4: 230, fk: 2140, fp: 118, fd: 6, c7: 480, dr: [['Red Bull', 4], ['Kaffee (Tasse)', 2]] } },
    { id: 'demo-jonas', name: 'Jonas', t: t(3), stats: { s: 12, b: 70, w4: 11, v4: 98400, x4: 196, e: { bench_press: 105, squat: 140, deadlift: 175 }, bw: 84.1, m4: 5, p4: 16, k4: 31, t4: 190, fk: 3480, fp: 162, fd: 7, c7: 1120, dr: [['Monster Energy', 6], ['Effect', 1]] } },
    { id: 'demo-mert', name: 'Mert', t: t(6), stats: { s: 128, b: 128, w4: 17, v4: 87300, x4: 289, e: { bench_press: 92.5, squat: 120 }, bw: 78.0, m4: 0, p4: 17, k4: 12, t4: 270, fk: 2890, fp: 141, fd: 5, c7: 160, dr: [['Nocco BCAA', 1]] } },
  ];

  // Energy-Drinks der letzten Tage
  const drinks = [];
  const pick = [['monster', 'Monster Energy', 500, 160], ['redbull', 'Red Bull', 250, 80], ['coffee', 'Kaffee (Tasse)', 200, 90]];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    for (let k = 0; k < 1 + (i % 2); k++) {
      const [key, name, ml, mg] = pick[(i + k) % 3];
      drinks.push({ id: `dd${i}${k}`, t: d.getTime() - (8 - k * 3) * 36e5, date: dateStr(d), key, name, ml, mg });
    }
  }

  return {
    schema: 1,
    drinks,
    body,
    friends,
    profile: { id: 'demo-me', name: 'Alex' },
    settings: { bar: 20 },
    planVersions: [{ from: dateStr(start), days: v1 }, { from: dateStr(switchDay), days: v2 }],
    customExercises: [{ id: 'c_demo_row', name: 'Kabelrudern einarmig', primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'] }],
    sessions,
  };
}
