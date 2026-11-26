// =============================================================
// presets.js – Vorlagen für Rhythmus-Pläne (z. B. Push · Pull · Legs · Pause)
//
// Übungsauswahl nach aktuellem Stand für Muskelaufbau: pro Einheit eine
// schwere Grundübung zuerst, dann Mehrgelenk- und Isolationsübungen mit
// Betonung der gedehnten Position (z. B. Schrägbank-Curls, Trizeps über
// Kopf, Beinbeuger sitzend). Pausen 2–3 min bei Grundübungen, 1,5 min
// bei Isolation. Alles danach frei anpassbar.
// =============================================================

import { getExercise } from './exercises.js';

const ex = (exId, sets, rest) => ({ exId, name: getExercise(exId)?.name || exId, sets, rest });

const W = {
  push: () => ({ name: 'Push', exercises: [ex('bench_press', 4, 180), ex('db_incline', 3, 120), ex('db_shoulder_press', 3, 120), ex('cable_fly', 3, 90), ex('lateral_raise', 3, 90), ex('overhead_ext', 3, 90)] }),
  pull: () => ({ name: 'Pull', exercises: [ex('pullup', 3, 150), ex('barbell_row', 3, 150), ex('cable_row', 3, 120), ex('face_pull', 3, 90), ex('incline_curl', 3, 90), ex('hammer_curl', 2, 90)] }),
  legs: () => ({ name: 'Legs', exercises: [ex('squat', 4, 180), ex('rdl', 3, 150), ex('leg_press', 3, 120), ex('leg_curl_seated', 3, 90), ex('leg_ext', 3, 90), ex('standing_calf', 4, 60)] }),
  upper: () => ({ name: 'Oberkörper', exercises: [ex('bench_press', 3, 180), ex('barbell_row', 3, 150), ex('db_shoulder_press', 3, 120), ex('lat_pulldown', 3, 120), ex('lateral_raise', 3, 90), ex('incline_curl', 2, 90), ex('overhead_ext', 2, 90)] }),
  lower: () => ({ name: 'Unterkörper', exercises: [ex('squat', 3, 180), ex('rdl', 3, 150), ex('leg_press', 3, 120), ex('leg_curl_seated', 3, 90), ex('standing_calf', 3, 60), ex('cable_crunch', 3, 60)] }),
  full: () => ({ name: 'Ganzkörper', exercises: [ex('squat', 3, 180), ex('bench_press', 3, 180), ex('barbell_row', 3, 150), ex('rdl', 2, 150), ex('lateral_raise', 2, 90), ex('incline_curl', 2, 90), ex('overhead_ext', 2, 90)] }),
};

/** Vorlagen: Name, Beschreibung, Tage (null = Pause). */
export const PRESETS = [
  { id: 'ppl', name: 'Push · Pull · Legs · Pause', sub: '4-Tage-Rhythmus – jeder Muskel knapp 2× pro Woche', days: () => [W.push(), W.pull(), W.legs(), null] },
  { id: 'ppl2', name: 'Push · Pull · Legs · Pause · Pause', sub: '5-Tage-Rhythmus – mehr Erholung', days: () => [W.push(), W.pull(), W.legs(), null, null] },
  { id: 'ul', name: 'Oberkörper · Unterkörper · Pause', sub: '3-Tage-Rhythmus – jeder Muskel ~2,3× pro Woche', days: () => [W.upper(), W.lower(), null] },
  { id: 'fb', name: 'Ganzkörper · Pause', sub: '2-Tage-Rhythmus – gut für den Einstieg', days: () => [W.full(), null] },
];
