// =============================================================
// coach.js – evidenzbasierte Trainingsvorschläge (reine Berechnung)
//
// Grundlage (Stand der Forschung 2023–2025, Muskelaufbau):
// - Wiederholungen: Zwischen ca. 5 und 30 Wdh. wachsen Muskeln ähnlich gut,
//   solange die Sätze nah ans Muskelversagen gehen (Schoenfeld et al. 2017,
//   2021). Praktisch: schwere Grundübungen 6–10, andere Mehrgelenk-
//   übungen 8–12, Isolation 10–15, kleine Muskeln 12–20.
// - Satzende: 0–3 Wdh. im Tank. Muskelwachstum steigt, je näher am
//   Versagen (Refalo et al. 2023, Robinson et al. 2024); echtes Versagen
//   ist nicht nötig, am ehesten sinnvoll bei Isolation im letzten Satz.
// - Volumen: ca. 10–20 harte Sätze pro Muskel und Woche, mehr bringt mit
//   abnehmendem Zusatznutzen noch etwas (Schoenfeld 2017, Pelland 2024).
// - Pausen: ≥ 2 min bei Grundübungen, 1–2 min bei Isolation – kurze
//   Pausen unter 60 s kosten Wachstum (Schoenfeld 2016, Singer 2024).
// - Bewegungsumfang: voller Weg mit Betonung der gedehnten Position
//   (Wolf et al. 2023/2025, Maeo 2021/2023).
// - Progression: "Doppelte Progression" – erst Wiederholungen im Bereich
//   steigern, wird das obere Ende in allen Sätzen erreicht, Gewicht hoch.
// =============================================================

import { data, exUnit } from './store.js';
import { e1rm } from './stats.js';
import { getExercise } from './exercises.js';
import { fmtWU, toU, fromU } from './util.js';

// ---------- Übungsarten ----------

const HEAVY = new Set(['squat', 'front_squat', 'deadlift', 'sumo_deadlift', 'bench_press', 'incline_bench', 'decline_bench', 'ohp',
  'barbell_row', 'pendlay_row', 'rack_pull', 'close_bench', 'smith_bench', 'smith_squat', 'hack_squat', 'pendulum_squat']);
const POWER = new Set(['power_clean', 'box_jump', 'kb_swing', 'thruster']);
const SMALL = new Set(['lateral_raise', 'cable_lateral', 'machine_lateral', 'reverse_fly', 'face_pull', 'standing_calf', 'seated_calf',
  'leg_press_calf', 'wrist_curl', 'reverse_curl', 'crunch', 'cable_crunch', 'ab_machine', 'hanging_leg_raise', 'leg_raise', 'situp',
  'russian_twist', 'woodchopper', 'pallof', 'dead_bug', 'kickback', 'concentration_curl', 'front_raise', 'shrugs', 'abductor_machine',
  'adductor_machine', 'cable_kickback', 'single_leg_calf']);
const ISOLATION = new Set(['db_fly', 'cable_fly', 'low_cable_fly', 'pec_deck', 'straight_arm_pulldown', 'pullover', 'barbell_curl', 'db_curl',
  'hammer_curl', 'preacher_curl', 'cable_curl', 'incline_curl', 'machine_curl', 'pushdown', 'rope_pushdown', 'skullcrusher', 'overhead_ext',
  'triceps_machine', 'leg_ext', 'leg_curl_lying', 'leg_curl_seated', 'nordic_curl', 'back_ext', 'upright_row', 'glute_bridge',
  'single_arm_cable_curl', 'single_arm_pushdown', 'single_arm_overhead_ext', 'single_leg_ext', 'single_leg_curl']);
const TIMED = new Set(['plank', 'side_plank', 'farmers_walk']);

const BARBELL = new Set(['bench_press', 'incline_bench', 'decline_bench', 'barbell_row', 'pendlay_row', 'deadlift', 'rdl', 'sumo_deadlift',
  'rack_pull', 'good_morning', 'ohp', 'barbell_curl', 'skullcrusher', 'close_bench', 'squat', 'front_squat', 'hip_thrust', 'power_clean',
  'thruster', 'smith_bench', 'smith_squat', 'upright_row', 'shrugs', 'glute_bridge']);
const LOWER_BIG = new Set(['squat', 'front_squat', 'deadlift', 'sumo_deadlift', 'rdl', 'rack_pull', 'hip_thrust', 'good_morning', 'leg_press',
  'hack_squat', 'pendulum_squat', 'smith_squat']);
const BODYWEIGHT = new Set(['pullup', 'chinup', 'dips', 'pushup', 'bench_dips', 'nordic_curl', 'hanging_leg_raise', 'leg_raise', 'situp',
  'crunch', 'plank', 'side_plank', 'dead_bug', 'ab_wheel', 'muscle_up', 'box_jump', 'back_ext', 'assisted_pullup']);

/** 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' */
export function equipment(exId) {
  if (BARBELL.has(exId)) return 'barbell';
  if (BODYWEIGHT.has(exId)) return 'bodyweight';
  const ex = getExercise(exId);
  const n = `${exId} ${ex?.name || ''}`.toLowerCase();
  if (/(cable|kabel|maschine|machine)/.test(n)) return 'machine'; // z. B. Glute Kickbacks am Kabel
  if (/(^db_|kurzhantel|dumbbell|hammer|lateral_raise|front_raise|arnold|goblet|bulgarian|lunges|step_up|kickback|concentration|incline_curl|pullover|wrist)/.test(n)) return 'dumbbell';
  return 'machine';
}

/** Kurzhantel-Übung: Gewicht wird pro Hantel eingetragen (eine Hantel, nicht beide zusammen). */
export const perDumbbell = (exId) => equipment(exId) === 'dumbbell';

/**
 * Wie viele Hanteln werden bewegt? (fürs Volumen; eingetragen wird immer das Gewicht EINER Hantel)
 * Beidseitig mit zwei Kurzhanteln (Bankdrücken, Curls, Seitheben …) = 2,
 * eine Hantel (Goblet Squat, Überzüge, einarmiges Rudern …) = 1.
 */
const ONE_DB = new Set(['pullover', 'goblet_squat']);
const TWO_DB_UNI = new Set(['bulgarian_split', 'lunges', 'step_up']); // je Hand eine Hantel, Beine abwechselnd
export function dumbbells(exId) {
  if (!perDumbbell(exId)) return 1;
  if (getExercise(exId)?.uni) return TWO_DB_UNI.has(exId) ? 2 : 1;
  return ONE_DB.has(exId) ? 1 : 2;
}

/** Ziel-Wiederholungsbereich [min, max] für Muskelaufbau. */
export function repRange(exId) {
  if (POWER.has(exId)) return [3, 6];
  if (TIMED.has(exId)) return null;
  if (HEAVY.has(exId)) return [6, 10];
  if (SMALL.has(exId)) return [12, 20];
  if (ISOLATION.has(exId)) return [10, 15];
  if (getExercise(exId)?.custom || exId.startsWith('c_')) return [8, 12];
  return [8, 12];
}

/** Empfohlene Pause in Sekunden. */
export function restAdvice(exId) {
  if (HEAVY.has(exId)) return [150, 240];
  if (SMALL.has(exId) || ISOLATION.has(exId)) return [60, 120];
  return [120, 180];
}

/** Kleinster sinnvoller Gewichtssprung. */
function stepFor(exId, w) {
  const eq = equipment(exId);
  if (eq === 'barbell') return LOWER_BIG.has(exId) && w >= 60 ? 5 : 2.5;
  if (eq === 'dumbbell') return w >= 20 ? 2.5 : 2;
  if (LOWER_BIG.has(exId)) return 5; // Beinpresse, Hackenschmidt
  return 2.5;
}
const roundTo = (v, step) => Math.round(v / step) * step;

/** Sprung in lb (Hantelscheiben in lb: 2,5 / 5 / 10 / 25 / 35 / 45). */
function stepForLb(exId, lb) {
  const eq = equipment(exId);
  if (eq === 'barbell') return LOWER_BIG.has(exId) && lb >= 135 ? 10 : 5;
  if (LOWER_BIG.has(exId)) return 10;
  return 5;
}

/** Neues Gewicht (kg) = altes + Sprung, gerundet auf das, was es in der gewählten Einheit wirklich gibt. */
function raise(exId, wKg, times) {
  if (exUnit(exId) === 'lb') {
    const lb = toU(wKg, 'lb');
    return fromU(roundTo(lb + stepForLb(exId, lb) * times, 2.5), 'lb');
  }
  const eq = equipment(exId);
  return roundTo(wKg + stepFor(exId, wKg) * times, eq === 'dumbbell' && wKg < 20 ? 1 : 1.25);
}
const lower10 = (exId, wKg) => (exUnit(exId) === 'lb' ? fromU(roundTo(toU(wKg, 'lb') * 0.9, 5), 'lb') : roundTo(wKg * 0.9, 1.25));

// ---------- Verlauf ----------

/** Letzte n Trainings dieser Übung (neueste zuerst), nur mit erledigten Sätzen. */
function recent(exId, n = 3) {
  const out = [];
  for (let i = data.sessions.length - 1; i >= 0 && out.length < n; i--) {
    const ex = data.sessions[i].exercises.find((e) => e.exId === exId);
    const done = ex?.sets.filter((s) => s.status === 'done' && s.r != null);
    if (done?.length) out.push(done);
  }
  return out;
}

/** Arbeitsgewicht und Wiederholungen der Sätze mit diesem Gewicht. */
function working(sets) {
  const w = Math.max(...sets.map((s) => s.w || 0));
  const reps = sets.filter((s) => (s.w || 0) === w).map((s) => s.r);
  return { w, reps, min: Math.min(...reps), max: Math.max(...reps) };
}

/**
 * Vorschlag für das heutige Training.
 * Rückgabe: { kind, w, reps: [lo, hi] | null, target, head, why }
 *   kind: 'start' | 'up' | 'reps' | 'hold' | 'down' | 'time'
 */
export function suggest(exId) {
  const u = exUnit(exId);
  const fmtW = (kg) => fmtWU(kg, u);
  const range = repRange(exId);
  const hist = recent(exId, 3);
  if (!range) {
    const last = hist[0] ? working(hist[0]) : null;
    return { kind: 'time', w: last?.w || null, reps: null, target: last ? last.max + 5 : null,
      head: last ? `${last.max + 5} s halten` : 'Zeit steigern',
      why: 'Halteübung: jede Woche etwas länger halten, dann Zusatzgewicht.' };
  }
  const [lo, hi] = range;
  if (!hist.length) {
    return { kind: 'start', w: null, reps: range, target: hi - 2, head: `${lo}–${hi} Wdh.`,
      why: `Wähle ein Gewicht, mit dem du ${lo}–${hi} Wdh. schaffst und 1–3 im Tank bleiben.` };
  }
  const last = working(hist[0]);
  const prev = hist[1] ? working(hist[1]) : null;
  const eq = equipment(exId);

  // Körpergewicht ohne Zusatzlast: erst Wiederholungen, dann Zusatzgewicht
  if (!last.w) {
    if (last.min >= hi) return { kind: 'up', w: u === 'lb' ? fromU(5, 'lb') : 2.5, reps: [lo, hi], target: lo + 2, head: u === 'lb' ? '+5 lb Zusatzgewicht' : '+2,5 kg Zusatzgewicht',
      why: `Alle Sätze mit ${hi}+ Wdh. – Zeit für Zusatzgewicht (Gürtel, Weste oder Kurzhantel).` };
    return { kind: 'reps', w: null, reps: [lo, hi], target: Math.min(hi, last.max + 1), head: `${Math.min(hi, last.max + 1)} Wdh. anpeilen`,
      why: `Letztes Mal ${last.reps.join(' / ')} Wdh. – jeweils eine mehr schaffen.` };
  }

  // Oberes Ende in allen Arbeitssätzen erreicht → Gewicht steigern
  if (last.min >= hi) {
    const w = raise(exId, last.w, last.min >= hi + 4 ? 2 : 1);
    return { kind: 'up', w, reps: [lo, hi], target: lo + 1, head: `${fmtW(w)} × ${lo}–${lo + 2}`,
      why: `Letztes Mal alle Sätze mit ${hi}+ Wdh. bei ${fmtW(last.w)} → Gewicht steigern, Wdh. starten wieder unten.` };
  }
  // Im Bereich → gleiches Gewicht, Wiederholungen steigern
  if (last.min >= lo) {
    const t = Math.min(hi, last.reps[0] + 1);
    return { kind: 'reps', w: last.w, reps: [lo, hi], target: t, head: `${fmtW(last.w)} × ${t}`,
      why: `Letztes Mal ${last.reps.join(' / ')} Wdh. – gleiches Gewicht, in jedem Satz eine Wdh. mehr. Bei ${hi} Wdh. in allen Sätzen geht's hoch.` };
  }
  // Unter dem Bereich
  const justRaised = prev && prev.w < last.w;
  const twiceLow = prev && prev.w === last.w && prev.min < lo;
  if (twiceLow) {
    const w = lower10(exId, last.w);
    return { kind: 'down', w, reps: [lo, hi], target: lo + 2, head: `${fmtW(w)} × ${lo + 2}`,
      why: `Zweimal unter ${lo} Wdh. bei ${fmtW(last.w)} → ca. 10 % leichter und sauber neu aufbauen.` };
  }
  return { kind: 'hold', w: last.w, reps: [lo, hi], target: lo, head: `${fmtW(last.w)} × ${lo}+`,
    why: justRaised ? `Gewicht wurde gerade gesteigert – halten, bis du ${lo}+ Wdh. schaffst.`
      : `Letztes Mal unter ${lo} Wdh. – Gewicht halten und Wiederholungen aufbauen.` };
}

// ---------- Scheibenrechner ----------

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5];

/** Scheiben pro Seite für ein Gesamtgewicht (in der gewählten Einheit). Rückgabe { plates: [..], rest, perSide } */
export function platesFor(total, bar = 20, set = PLATES) {
  let side = (total - bar) / 2;
  if (side < 0) return { plates: [], rest: 0, perSide: 0, tooLight: true };
  const perSide = side;
  const plates = [];
  for (const p of set) {
    while (side >= p - 1e-9) { plates.push(p); side -= p; }
  }
  return { plates, rest: Math.round(side * 2 * 100) / 100, perSide };
}

export const hasPlates = (exId) => equipment(exId) === 'barbell';

// ---------- Rekorde ----------

/** Bisher bestes geschätztes Maximum (und schwerstes Gewicht) einer Übung, ohne das laufende Workout. */
export function bestBefore(exId) {
  let best = 0, heaviest = 0, count = 0;
  for (const s of data.sessions) {
    for (const ex of s.exercises) {
      if (ex.exId !== exId) continue;
      count++;
      for (const st of ex.sets) {
        if (st.status !== 'done' || !st.w || !st.r) continue;
        best = Math.max(best, e1rm(st.w, st.r));
        heaviest = Math.max(heaviest, st.w);
      }
    }
  }
  // selbst eingetragene Rekorde zählen als Vergleich mit
  for (const p of data.prs || []) {
    if (p.exId !== exId) continue;
    count++;
    best = Math.max(best, e1rm(p.w, p.r));
    heaviest = Math.max(heaviest, p.w);
  }
  return { best, heaviest, count };
}

/**
 * Prüft einen Satz auf Rekord. todaySets = bereits erledigte Sätze heute.
 * Rückgabe null oder { kind: 'e1rm' | 'weight', value, gain }.
 */
export function checkRecord(exId, w, r, todaySets = []) {
  if (!w || !r) return null;
  const b = bestBefore(exId);
  if (!b.count || !b.best) return null; // erstes Mal: noch kein Vergleich
  const todayBest = Math.max(0, ...todaySets.filter((s) => s?.w && s?.r).map((s) => e1rm(s.w, s.r)));
  const ref = Math.max(b.best, todayBest);
  const v = e1rm(w, r);
  if (v > ref + 0.05) return { kind: 'e1rm', value: v, gain: v - b.best };
  const todayHeavy = Math.max(0, ...todaySets.filter((s) => s?.w).map((s) => s.w));
  if (w > Math.max(b.heaviest, todayHeavy)) return { kind: 'weight', value: w, gain: w - b.heaviest };
  return null;
}

// ---------- Körpergewicht ----------

/**
 * Trend aus den Einträgen: gleitender 7-Tage-Schnitt, Veränderung pro Woche
 * über die letzten ~4 Wochen und Einordnung für Muskelaufbau.
 * Leitlinie: sauberer Aufbau ≈ +0,25–0,5 % Körpergewicht pro Woche
 * (Iraki et al. 2019; Fortgeschrittene eher am unteren Ende).
 */
export function bodyTrend(list = data.body) {
  if (!list.length) return null;
  const t = (ds) => new Date(ds + 'T12:00').getTime();
  const avgAround = (endDs) => {
    const end = t(endDs);
    const win = list.filter((b) => t(b.date) <= end && t(b.date) > end - 7 * 864e5);
    return win.reduce((a, b) => a + b.kg, 0) / win.length;
  };
  const last = list[list.length - 1];
  const now = avgAround(last.date);
  const target = t(last.date) - 28 * 864e5;
  const old = list.filter((b) => t(b.date) <= target + 3 * 864e5);
  let perWeek = null, pct = null;
  const ref = old.length ? old[old.length - 1] : list[0];
  const days = (t(last.date) - t(ref.date)) / 864e5;
  if (days >= 10) {
    const then = avgAround(ref.date);
    perWeek = ((now - then) / days) * 7;
    pct = (perWeek / then) * 100;
  }
  let verdict = 'Mindestens 2 Wochen regelmäßig wiegen, dann siehst du hier deinen Trend.';
  let tone = 'neutral';
  if (pct != null) {
    if (pct < -0.1) { verdict = 'Du nimmst ab – für maximalen Muskelaufbau leicht mehr essen (ca. +200–300 kcal).'; tone = 'warn'; }
    else if (pct < 0.2) { verdict = 'Gewicht stabil – gut zum Halten, für mehr Muskelaufbau ein kleiner Überschuss (+200–300 kcal).'; tone = 'neutral'; }
    else if (pct <= 0.6) { verdict = 'Im Zielbereich für sauberen Muskelaufbau (ca. +0,25–0,5 % pro Woche).'; tone = 'good'; }
    else { verdict = 'Schneller als nötig – über ~0,5 % pro Woche kommt vor allem Fett dazu. Etwas weniger essen.'; tone = 'warn'; }
  }
  return { current: now, last, perWeek, pct, verdict, tone };
}
