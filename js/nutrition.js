// =============================================================
// nutrition.js – Kalorien, Makros, Wasser, Ernährungsqualität
//
// Bedarf (geschätzt, wird später durch deine echten Daten korrigiert):
//   Grundumsatz  Mifflin-St Jeor; mit Körperfettanteil Katch-McArdle
//                (370 + 21,6 × fettfreie Masse) – genauer bei Sportlern.
//   Alltag       PAL nach DGE (Schüler/Studenten 1,6–1,7, Büro 1,4–1,5,
//                stehend/gehend 1,8–1,9, schwere Arbeit 2,0–2,4) oder
//                aus Schritten pro Tag (genauer, z. B. aus der Health-App).
//   Training     MET-Werte nach Compendium of Physical Activities (2024):
//                Netto-Verbrauch = (MET − 1) × kg × Stunden.
//   Gemessen     Sobald genug Daten da sind (≥ 14 Tage Essen + Gewicht):
//                echter Bedarf = Ø gegessen − Gewichtsänderung × 7.700 kcal/kg.
//                Das ist genauer als jede Formel.
// Ziel-Tempo:   Aufbau nach Erfahrung (Aragon): Anfänger ~0,4 %, Fortgeschr.
//                ~0,25 %, Erfahrene ~0,15 % Körpergewicht/Woche. Diät 0,7 %
//                (max. ~1 %/Woche, sonst Muskelverlust). Optional: Zielgewicht
//                bis Datum → nötiges Tempo wird berechnet und geprüft.
// Protein:      1,8 g/kg (Morton 2018: Plateau ab ~1,6, bis 2,2); Diät 2,2 g/kg.
//                Mit KFA: 2,2 bzw. 2,6 g/kg fettfreie Masse.
// Fett ≥ 0,8 g/kg bzw. 25 % kcal; Ballaststoffe ≥ 30 g (DGE);
// freier Zucker < 10 % kcal (WHO); gesättigte Fette < 10 % kcal;
// Gemüse 400 g + Obst 250 g (DGE); Wasser: EFSA 2,5 L (m) / 2,0 L (w)
// gesamt, davon ~80 % trinken, + ~0,5 L je Trainingsstunde.
// Nährwerte der eingebauten Liste: Durchschnittswerte je 100 g (ca.).
// =============================================================

import { PUSH_SERVER } from './push-config.js';
import { data, save, sessionsByDate, currentVersion, plannedOf } from './store.js';
import { addDays, dateStr, uid, parseDate } from './util.js';
import { bodyTrend } from './coach.js';

const KCAL_PER_KG = 7700;

export const JOBS = [
  [1.4, 'Überwiegend sitzend', 'Büro, viel Sitzen'],
  [1.6, 'Sitzend, gehend, stehend', 'Schule, Studium, gemischt'],
  [1.8, 'Viel stehend und gehend', 'Verkauf, Kellnern, Handwerk'],
  [2.1, 'Körperlich schwer', 'Bau, Landwirtschaft, Lager'],
];
export const SPORTS = { none: ['Keine', 0], fussball: ['Fußball', 8], laufen: ['Laufen', 9], schwimmen: ['Schwimmen', 7], rad: ['Radfahren', 7], kampf: ['Kampfsport', 10], andere: ['Andere', 6] };
export const LEVELS = { beginner: ['Anfänger', 0.4, '< 1 Jahr'], intermediate: ['Fortgeschritten', 0.25, '1–3 Jahre'], advanced: ['Erfahren', 0.15, '> 3 Jahre'] };
export const GOALS = { bulk: ['Aufbau'], keep: ['Halten'], cut: ['Diät'] };
const LIFT_MET = 5; // Krafttraining inkl. Satzpausen (Compendium: 3,5–6)

// prettier-ignore
// [Name, kcal, Protein, KH, Fett, Ballaststoffe, Zucker, ges. Fett (je 100 g), Portion g, Portion, Kategorie]
// Kategorie: v = Gemüse/Hülsenfrüchte, o = Obst, j = Saft, d = Milchprodukt, '' = sonstiges
const RAW = [
  ['Haferflocken', 370, 13.5, 59, 7, 10, 1, 1.3, 60, 'Portion', ''], ['Reis (gekocht)', 130, 2.7, 28, 0.3, 0.4, 0, 0.1, 200, 'Teller', ''],
  ['Reis (roh)', 350, 7, 78, 0.6, 1.3, 0.1, 0.2, 80, 'Portion', ''], ['Nudeln (gekocht)', 150, 5.5, 29, 0.9, 1.8, 0.6, 0.2, 250, 'Teller', ''],
  ['Vollkornnudeln (gekocht)', 140, 6, 26, 1, 4, 0.8, 0.2, 250, 'Teller', ''], ['Nudeln (roh)', 360, 12, 72, 1.5, 3, 3, 0.3, 100, 'Portion', ''],
  ['Kartoffeln (gekocht)', 72, 2, 15, 0.1, 1.8, 0.8, 0, 250, 'Portion', ''], ['Süßkartoffel', 86, 1.6, 20, 0.1, 3, 4.2, 0, 200, 'Stück', ''],
  ['Vollkornbrot', 220, 7.5, 40, 1.5, 7, 3, 0.3, 50, 'Scheibe', ''], ['Toastbrot', 260, 8, 48, 3.5, 2.5, 5, 0.8, 25, 'Scheibe', ''],
  ['Brötchen', 270, 9, 53, 1.5, 3, 3, 0.3, 60, 'Stück', ''], ['Hähnchenbrust (roh)', 105, 23, 0, 1.2, 0, 0, 0.3, 200, 'Portion', ''],
  ['Hähnchenbrust (gebraten)', 150, 30, 0, 3, 0, 0, 0.9, 150, 'Portion', ''], ['Putenbrust', 107, 24, 0, 1, 0, 0, 0.3, 150, 'Portion', ''],
  ['Rinderhack', 250, 18, 0, 20, 0, 0, 8.5, 125, 'Portion', ''], ['Rindersteak', 140, 22, 0, 5, 0, 0, 2, 200, 'Steak', ''],
  ['Lachs', 200, 20, 0, 13, 0, 0, 2.5, 125, 'Filet', ''], ['Thunfisch (Dose, Wasser)', 110, 25, 0, 1, 0, 0, 0.3, 130, 'Dose', ''],
  ['Ei', 155, 13, 1, 11, 0, 1, 3.3, 60, 'Stück', ''], ['Eiklar', 48, 11, 0.7, 0.2, 0, 0.7, 0, 100, 'Portion', ''],
  ['Magerquark', 67, 12, 4, 0.2, 0, 4, 0.1, 250, 'Becher', 'd'], ['Skyr', 63, 11, 4, 0.2, 0, 4, 0.1, 150, 'Becher', 'd'],
  ['Hüttenkäse', 100, 12, 3, 4.5, 0, 3, 2.8, 200, 'Becher', 'd'], ['Griechischer Joghurt', 120, 4, 4, 10, 0, 4, 6.5, 150, 'Portion', 'd'],
  ['Milch 1,5 %', 47, 3.4, 4.8, 1.5, 0, 4.8, 1, 250, 'Glas', 'd'], ['Gouda', 360, 25, 0, 28, 0, 0, 18, 30, 'Scheibe', 'd'],
  ['Mozzarella', 250, 18, 1, 19, 0, 1, 12, 125, 'Kugel', 'd'], ['Whey-Protein (Pulver)', 380, 75, 8, 6, 0, 6, 3, 30, 'Shake', ''],
  ['Tofu', 120, 13, 1.5, 7, 1, 0.6, 1, 200, 'Packung', ''], ['Linsen (gekocht)', 115, 9, 17, 0.4, 8, 1.8, 0.1, 200, 'Portion', 'v'],
  ['Kichererbsen (gekocht)', 140, 8, 20, 2.5, 7.5, 4.8, 0.3, 150, 'Portion', 'v'], ['Kidneybohnen (Dose)', 95, 7, 13, 0.5, 6, 0.5, 0.1, 130, 'Portion', 'v'],
  ['Erbsen (TK)', 81, 5.4, 14, 0.4, 5.7, 5.7, 0.1, 150, 'Portion', 'v'], ['Brokkoli', 34, 2.8, 4, 0.4, 3, 1.7, 0.1, 200, 'Portion', 'v'],
  ['Gemüse gemischt', 40, 2, 6, 0.4, 3, 3, 0.1, 200, 'Portion', 'v'], ['Salat (gemischt)', 17, 1.3, 2, 0.2, 1.5, 1.5, 0, 100, 'Schüssel', 'v'],
  ['Tomate', 18, 0.9, 2.6, 0.2, 1.2, 2.6, 0, 100, 'Stück', 'v'], ['Gurke', 12, 0.6, 1.8, 0.1, 0.5, 1.7, 0, 200, 'Stück', 'v'],
  ['Paprika', 31, 1, 6, 0.3, 2, 4, 0, 150, 'Stück', 'v'], ['Karotte', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 0, 80, 'Stück', 'v'],
  ['Spinat', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.1, 150, 'Portion', 'v'], ['Avocado', 160, 2, 2, 15, 6.7, 0.7, 2.1, 80, 'Hälfte', 'v'],
  ['Banane', 95, 1.1, 21, 0.3, 2.6, 17, 0.1, 120, 'Stück', 'o'], ['Apfel', 52, 0.3, 11.4, 0.2, 2.4, 10, 0, 150, 'Stück', 'o'],
  ['Orange', 47, 0.9, 12, 0.1, 2.4, 9, 0, 180, 'Stück', 'o'], ['Trauben', 69, 0.7, 18, 0.2, 0.9, 16, 0, 150, 'Portion', 'o'],
  ['Kiwi', 61, 1.1, 15, 0.5, 3, 9, 0, 75, 'Stück', 'o'], ['Beeren (TK)', 45, 1, 8, 0.4, 4, 7, 0, 150, 'Portion', 'o'],
  ['Erdnussbutter', 600, 25, 13, 50, 6, 6, 10, 20, 'Löffel', ''], ['Mandeln', 600, 21, 6, 52, 12, 4.4, 4, 30, 'Handvoll', ''],
  ['Walnüsse', 650, 15, 7, 65, 6.5, 2.6, 6, 30, 'Handvoll', ''], ['Olivenöl', 884, 0, 0, 100, 0, 0, 14, 10, 'Esslöffel', ''],
  ['Butter', 740, 0.7, 0.6, 82, 0, 0.6, 51, 10, 'Portion', 'd'], ['Honig', 305, 0.4, 76, 0, 0, 76, 0, 20, 'Löffel', ''],
  ['Reiswaffel', 380, 8, 80, 3, 4, 0.6, 0.6, 8, 'Stück', ''], ['Müsli (ungesüßt)', 360, 10, 60, 6, 9, 8, 1, 60, 'Portion', ''],
  ['Pizza (TK)', 250, 10, 30, 10, 2, 4, 4.5, 350, 'Pizza', ''], ['Döner', 215, 12, 20, 10, 1.5, 2.5, 4, 350, 'Stück', ''],
  ['Pommes', 290, 3.5, 36, 15, 3, 0.3, 2.5, 150, 'Portion', ''], ['Burger', 250, 13, 24, 11, 1.5, 5, 4.5, 250, 'Stück', ''],
  ['Schokolade', 540, 6, 57, 31, 3, 50, 19, 25, 'Riegel', ''], ['Gummibärchen', 340, 7, 77, 0.1, 0, 46, 0, 50, 'Handvoll', ''],
  ['Chips', 540, 6, 50, 34, 4, 0.5, 3, 50, 'Portion', ''], ['Proteinriegel', 360, 33, 35, 10, 10, 3, 5, 60, 'Riegel', ''],
  ['Cola', 42, 0, 10.6, 0, 0, 10.6, 0, 330, 'Dose', ''], ['Orangensaft', 45, 0.7, 10, 0.2, 0.2, 9, 0, 250, 'Glas', 'j'],
  ['Spaghetti Bolognese', 150, 7, 19, 5, 1.8, 2.5, 1.8, 400, 'Teller', ''], ['Sushi (gemischt)', 150, 6, 27, 2, 0.8, 4, 0.4, 250, 'Portion', ''],
  ['Wrap mit Hähnchen', 200, 12, 22, 7, 2, 2, 1.8, 250, 'Stück', ''], ['Tortilla-Fladen (Weizen)', 310, 8, 50, 8, 3, 3, 3, 60, 'Stück', ''],
  ['Currywurst mit Soße', 230, 9, 12, 16, 0.8, 8, 6, 250, 'Portion', ''], ['Schnitzel paniert', 230, 20, 12, 11, 0.6, 0.5, 2.5, 180, 'Stück', ''],
  ['Pfannkuchen', 210, 7, 26, 8, 1, 6, 3, 100, 'Stück', ''], ['Kaiserschmarrn', 260, 7, 33, 11, 1, 15, 5, 300, 'Portion', ''],
];
const BUILTIN_DRINKS = new Set(['Milch 1,5 %', 'Cola', 'Orangensaft']);
export const FOODS = RAW.map(([name, kcal, p, c, f, fib, sug, sat, portion, unit, cat]) => ({ id: 'b:' + name, name, kcal, p, c, f, fib, sug, sat, portion, unit, cat, ...(BUILTIN_DRINKS.has(name) ? { liquid: true } : {}) }));

// ---------- Profil & Bedarf ----------

export const profile = () => data.nutrition || {};

/** Aktuelles Körpergewicht: 7-Tage-Schnitt aus dem Gewichtsverlauf, sonst Eingabe. */
export function weightNow() {
  const t = bodyTrend();
  return t ? t.current : profile().weight || null;
}

/** Grundumsatz: Katch-McArdle mit KFA, sonst Mifflin-St Jeor. */
function bmrOf(n, w) {
  if (n.bodyFat > 3 && n.bodyFat < 60) return 370 + 21.6 * w * (1 - n.bodyFat / 100);
  return 10 * w + 6.25 * n.height - 5 * n.age + (n.sex === 'f' ? -161 : 5);
}

/** Alltags-PAL: aus Schritten (genauer) oder aus Beruf/Alltag (DGE). Alte Profile: "activity". */
function palOf(n) {
  if (n.steps > 0) {
    const pal = 1.3 + Math.max(0, n.steps - 3000) / 1000 * 0.05;
    const jobExtra = Number(n.job) >= 1.8 ? (n.job >= 2 ? 0.4 : 0.2) : 0; // schwere Arbeit zählt nicht nur über Schritte
    return Math.min(2.4, pal + jobExtra);
  }
  if (Number(n.job) >= 1.2 && Number(n.job) <= 2.4) return Number(n.job);
  return Number(n.activity) > 0 ? Math.min(Number(n.activity), 1.9) : 1.6; // ungültige Angabe → Durchschnitt
}

/** Trainings- und Sportverbrauch pro Tag (netto, über die Woche gemittelt). */
function exerciseOf(n, w) {
  const lift = (n.trainDays || 0) * ((n.trainMin || 60) / 60) * (LIFT_MET - 1);
  const sport = (n.sportHours || 0) * ((SPORTS[n.sport || 'none']?.[1] || 6) - 1);
  return ((lift + sport) * w) / 7;
}

/**
 * Gemessener Bedarf aus deinen Daten (genauer als jede Formel):
 * Ø gegessen − Gewichtsänderung × 7.700 kcal/kg, über die letzten 21 Tage.
 * Nur wenn genug Tage eingetragen sind (≥ 10 von 14+) und Gewicht vorhanden ist.
 */
export function measuredTDEE(today = new Date()) {
  const days = 21;
  const from = dateStr(addDays(today, -days));
  const to = dateStr(addDays(today, -1)); // heute ist noch nicht fertig
  const logged = [];
  for (let d = parseDate(from); dateStr(d) <= to; d = addDays(d, 1)) {
    const ds = dateStr(d);
    const list = entriesOf(ds);
    if (list.length >= 2) logged.push(sumOf(list).kcal);
  }
  const body = data.body.filter((b) => b.date >= from && b.date <= to);
  if (logged.length < 10 || body.length < 6) return null;
  // Gewichtstrend: lineare Regression über die Messungen (robuster als erster/letzter Wert)
  const t0 = parseDate(body[0].date).getTime();
  const xs = body.map((b) => (parseDate(b.date).getTime() - t0) / 864e5), ys = body.map((b) => b.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1); // kg/Tag
  const intake = logged.reduce((a, b) => a + b, 0) / logged.length;
  const tdee = intake - slope * KCAL_PER_KG;
  return tdee > 1200 && tdee < 6000 ? { tdee: Math.round(tdee), intake: Math.round(intake), kgPerWeek: slope * 7, days: logged.length } : null;
}

/**
 * Tagesziele. Rückgabe null, wenn Angaben fehlen. Enthält auch Erklärung:
 * { kcal, p, c, f, fib, water, bmr, tdee, tdeeSource, rate, weekly, warn[], plan }
 */
export function targets(today = new Date()) {
  const n = profile();
  const w = weightNow();
  if (!w || !n.height || !n.age || !n.sex) return null;
  const bmr = bmrOf(n, w);
  const est = bmr * palOf(n) + exerciseOf(n, w);
  const meas = measuredTDEE(today);
  const tdee = meas ? meas.tdee : est;
  const goal = n.goal || 'bulk';
  const warn = [];

  // Tempo: aus Zielgewicht + Datum oder Standard nach Ziel/Erfahrung (% Körpergewicht pro Woche)
  let rate = goal === 'bulk' ? (LEVELS[n.level] || LEVELS.intermediate)[1] : goal === 'cut' ? -0.7 : 0;
  let plan = null;
  if (n.targetWeight && n.targetDate && n.targetDate > dateStr(today)) {
    const weeks = (parseDate(n.targetDate) - parseDate(dateStr(today))) / (7 * 864e5);
    const kgPerWeek = (n.targetWeight - w) / weeks;
    rate = (kgPerWeek / w) * 100;
    plan = { kgPerWeek, weeks, target: n.targetWeight, date: n.targetDate };
    if (rate > 0.5) warn.push(`${fmt1(kgPerWeek)} kg pro Woche ist zu schnell für sauberen Aufbau – über ~0,5 % pro Woche kommt vor allem Fett dazu. Lieber ein späteres Datum.`);
    if (rate < -1) warn.push(`${fmt1(-kgPerWeek)} kg pro Woche abnehmen ist zu schnell – über ~1 % pro Woche gehen Muskeln verloren. Lieber ein späteres Datum.`);
    if (goal === 'bulk' && kgPerWeek < 0) warn.push('Zielgewicht liegt unter deinem Gewicht, Ziel steht aber auf Aufbau.');
    if (goal === 'cut' && kgPerWeek > 0) warn.push('Zielgewicht liegt über deinem Gewicht, Ziel steht aber auf Diät.');
  }
  const delta = (rate / 100) * w * KCAL_PER_KG / 7;
  let kcal = Math.round((tdee + delta + (n.adjust || 0)) / 10) * 10;
  const floor = Math.round(bmr / 10) * 10;
  if (kcal < floor) { warn.push(`Unter deinem Grundumsatz (${floor} kcal) zu essen ist nicht sinnvoll – Ziel auf ${floor} kcal begrenzt.`); kcal = floor; }
  if (n.kcal) kcal = n.kcal;

  const lbm = n.bodyFat > 3 && n.bodyFat < 60 ? w * (1 - n.bodyFat / 100) : null;
  const p = Math.round(lbm ? lbm * (goal === 'cut' ? 2.6 : 2.2) : w * (goal === 'cut' ? 2.2 : 1.8));
  const f = Math.round(Math.max(w * 0.8, (kcal * 0.25) / 9));
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return {
    kcal, p, c, f, fib: 30, water: waterTarget(dateStr(today), w),
    bmr: Math.round(bmr), tdee: Math.round(tdee), est: Math.round(est), measured: meas,
    rate, weekly: (rate / 100) * w, delta: Math.round(delta), warn, plan,
  };
}
const fmt1 = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Vorschlag anhand des Gewichtsverlaufs (nur ohne gemessenen Bedarf – der korrigiert ja schon selbst). */
export function adjustHint() {
  if (measuredTDEE()) return null;
  const t = bodyTrend();
  const goal = profile().goal || 'bulk';
  if (!t || t.pct == null) return null;
  const pct = t.pct;
  if (goal === 'bulk' && pct < 0.1) return { delta: 150, text: `Dein Gewicht steigt kaum (${fmtPct(pct)}/Woche). Für Aufbau ca. +150 kcal pro Tag.` };
  if (goal === 'bulk' && pct > 0.6) return { delta: -150, text: `Du nimmst schnell zu (${fmtPct(pct)}/Woche) – dabei kommt vor allem Fett dazu. Ca. −150 kcal pro Tag.` };
  if (goal === 'cut' && pct > -0.3) return { delta: -150, text: `Du nimmst kaum ab (${fmtPct(pct)}/Woche). Ca. −150 kcal pro Tag.` };
  if (goal === 'cut' && pct < -1.0) return { delta: 150, text: `Du nimmst sehr schnell ab (${fmtPct(pct)}/Woche) – Muskeln in Gefahr. Ca. +150 kcal pro Tag.` };
  if (goal === 'keep' && Math.abs(pct) > 0.25) return { delta: pct > 0 ? -100 : 100, text: `Dein Gewicht verändert sich (${fmtPct(pct)}/Woche). Ca. ${pct > 0 ? '−' : '+'}100 kcal pro Tag.` };
  return null;
}
const fmtPct = (v) => `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v * 100) / 100).toString().replace('.', ',')} %`;

export function saveProfile(patch) {
  data.nutrition = { ...profile(), ...patch };
  save();
}

// ---------- Wasser ----------

/** Trink-Ziel in ml: ~80 % des EFSA-Gesamtwassers + 0,5 L je Trainingsstunde an Trainingstagen. */
export function waterTarget(ds = dateStr(), w = weightNow()) {
  const n = profile();
  let base = n.sex === 'f' ? 1600 : 2000;
  if (w) base = Math.max(base, Math.round(w * 27)); // schwere Menschen brauchen mehr
  const trained = sessionsByDate().has(ds) || !!plannedOf(currentVersion(), ds);
  const extra = trained ? Math.round(((n.trainMin || 60) / 60) * 500) : 0;
  return Math.round((base + extra) / 50) * 50;
}

export function logWater(ml) {
  data.water.push({ id: uid(), t: Date.now(), date: dateStr(), ml });
  save();
}
export function undoWater(ds = dateStr()) {
  const i = data.water.map((x) => x.date).lastIndexOf(ds);
  if (i >= 0) { data.water.splice(i, 1); save(); }
}
/**
 * Trinkmenge des Tages: Wasser (+250 ml / +0,5 L) UND alle anderen Getränke (Saft, Milch, Kaffee, Tee,
 * Cola, Energy-Drinks …), denn laut DGE zählen alle Getränke zur Flüssigkeitszufuhr. Alkohol zählt nicht.
 */
export const waterOnly = (ds) => data.water.filter((x) => x.date === ds).reduce((a, x) => a + x.ml, 0);
export function drinksMl(ds) {
  let ml = 0;
  for (const e of data.food) if (e.date === ds && e.ref?.liquid && !e.ref.alc && e.g) ml += e.g;
  // Energy-Drinks/Kaffee ohne Kalorien-Eintrag (sonst schon oben gezählt)
  for (const d of data.drinks || []) if (d.date === ds && d.ml && !d.foodId) ml += d.ml;
  return ml;
}
export const waterOf = (ds) => waterOnly(ds) + drinksMl(ds);

// ---------- Einträge ----------

const r1 = (v) => Math.round(v * 10) / 10;

/** Eintrag aus Lebensmittel (Werte je 100 g) und Menge in g. */
export function logFood(food, grams) {
  const k = grams / 100;
  const e = {
    id: uid(), t: Date.now(), date: dateStr(), name: food.name, g: Math.round(grams), cat: food.cat || '',
    kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k),
    fib: r1((food.fib || 0) * k), sug: r1((food.sug || 0) * k), sat: r1((food.sat || 0) * k),
    ...(food.meal ? { vegG: Math.round((food.vegP || 0) * k), fruitG: Math.round((food.fruitP || 0) * k), freeSug: r1((food.freeSugP || 0) * k) } : {}),
    ref: { id: food.id, kcal: food.kcal, p: food.p, c: food.c, f: food.f, fib: food.fib, sug: food.sug, sat: food.sat, portion: food.portion, unit: food.unit, cat: food.cat, ...(food.liquid ? { liquid: true } : {}), ...(food.alc ? { alc: true } : {}), ...(food.pack ? { pack: food.pack } : {}) },
  };
  data.food.push(e);
  save();
  return e;
}

/** Schnell eintragen: kcal und/oder Makros. Fehlen kcal, werden sie aus den Makros berechnet. */
export function logQuick(name, { kcal, p = 0, c = 0, f = 0 }) {
  const k = kcal || Math.round(p * 4 + c * 4 + f * 9);
  const e = { id: uid(), t: Date.now(), date: dateStr(), name: name || 'Schnell eingetragen', kcal: Math.round(k), p: r1(p), c: r1(c), f: r1(f) };
  data.food.push(e);
  save();
  return e;
}

/**
 * Eintrag ändern: Menge (g) → alle Werte anteilig; Schnelleintrag → Werte direkt; Uhrzeit "HH:MM".
 */
export function updateFood(id, { g, name, kcal, p, c, f, time } = {}) {
  const e = data.food.find((x) => x.id === id);
  if (!e) return null;
  if (g && e.g) {
    const k = g / e.g;
    for (const key of ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'sat', 'vegG', 'fruitG', 'freeSug']) {
      if (e[key] == null) continue;
      // genau: aus den Werten je 100 g, sonst anteilig
      const v = e.ref?.[key] != null ? e.ref[key] * g / 100 : e[key] * k;
      e[key] = key === 'kcal' || key.endsWith('G') ? Math.round(v) : r1(v);
    }
    e.g = Math.round(g);
  } else if (kcal != null || p != null || c != null || f != null) {
    if (p != null) e.p = r1(p);
    if (c != null) e.c = r1(c);
    if (f != null) e.f = r1(f);
    e.kcal = Math.round(kcal || e.p * 4 + e.c * 4 + e.f * 9);
  }
  if (name) e.name = String(name).slice(0, 60);
  if (/^\d{2}:\d{2}$/.test(time || '')) {
    const d = new Date(e.t);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    e.t = d.getTime();
  }
  save();
  return e;
}

export function removeFood(id) {
  data.food = data.food.filter((x) => x.id !== id);
  save();
}

export const entriesOf = (ds) => data.food.filter((x) => x.date === ds);

export function sumOf(list) {
  const z = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, freeSug: 0, sat: 0, veg: 0, fruit: 0, known: 0 };
  for (const x of list) {
    z.kcal += x.kcal; z.p += x.p || 0; z.c += x.c || 0; z.f += x.f || 0;
    z.fib += x.fib || 0; z.sug += x.sug || 0; z.sat += x.sat || 0;
    // Freier Zucker (WHO): Zucker aus Obst/Gemüse/Milch zählt nicht, Saft schon
    if (x.freeSug != null) z.freeSug += x.freeSug; // Gericht: schon aus den Zutaten berechnet
    else if (x.cat !== 'o' && x.cat !== 'v' && x.cat !== 'd') z.freeSug += x.sug || 0;
    if (x.cat === 'v') z.veg += x.g || 0;
    if (x.cat === 'o') z.fruit += x.g || 0;
    z.veg += x.vegG || 0;
    z.fruit += x.fruitG || 0;
    if (x.cat === 'j') z.fruit += Math.min(x.g || 0, 150) * 0.5; // Saft zählt höchstens halb
    if (x.ref || x.fib != null) z.known += x.kcal; // Einträge mit Detail-Nährwerten
  }
  return z;
}

// ---------- Ernährungsqualität (0–100) ----------

/**
 * Bewertet einen Tag nach anerkannten Empfehlungen (DGE, WHO, Sporternährung):
 *  Protein-Ziel 20 · Kalorien-Ziel 10 · Gemüse 12 · Obst 8 · Ballaststoffe 15
 *  · freier Zucker 10 · gesättigte Fette 10 · Wasser 15
 */
export function healthScore(ds = dateStr(), t = targets()) {
  const list = entriesOf(ds);
  if (!list.length || !t) return null;
  const s = sumOf(list);
  const water = waterOf(ds);
  const lin = (v, full, zero) => Math.max(0, Math.min(1, (v - zero) / (full - zero)));
  const kcalDev = Math.abs(s.kcal - t.kcal) / t.kcal;
  const parts = [
    ['Protein', 20, lin(s.p, t.p * 0.9, t.p * 0.5), `${Math.round(s.p)} / ${t.p} g`, 'Protein in jede Mahlzeit: Quark, Skyr, Eier, Fleisch, Fisch, Hülsenfrüchte.'],
    ['Kalorien im Ziel', 10, kcalDev <= 0.1 ? 1 : lin(kcalDev, 0.1, 0.3), `${Math.round(s.kcal)} / ${t.kcal} kcal`, 'Für dein Ziel möglichst nah an der Vorgabe (±10 %) bleiben.'],
    ['Gemüse', 12, lin(s.veg, 400, 0), `${Math.round(s.veg)} / 400 g`, 'DGE: mind. 3 Portionen Gemüse (400 g) am Tag – auch Hülsenfrüchte zählen.'],
    ['Obst', 8, lin(s.fruit, 250, 0), `${Math.round(s.fruit)} / 250 g`, 'DGE: 2 Portionen Obst (250 g) am Tag.'],
    ['Ballaststoffe', 15, lin(s.fib, 30, 10), `${Math.round(s.fib)} / 30 g`, 'Vollkorn, Haferflocken, Hülsenfrüchte, Gemüse, Nüsse.'],
    ['Freier Zucker', 10, lin((s.freeSug * 4) / Math.max(s.kcal, 1), 0.1, 0.18), `${Math.round(s.freeSug)} g (${Math.round(((s.freeSug * 4) / Math.max(s.kcal, 1)) * 100)} % kcal)`, 'WHO: unter 10 % der Kalorien aus zugesetztem Zucker und Saft.'],
    ['Gesättigte Fette', 10, lin((s.sat * 9) / Math.max(s.kcal, 1), 0.1, 0.15), `${Math.round(s.sat)} g (${Math.round(((s.sat * 9) / Math.max(s.kcal, 1)) * 100)} % kcal)`, 'Unter 10 % der Kalorien: weniger Wurst, Butter, Fast Food – mehr Olivenöl, Nüsse, Fisch.'],
    ['Trinken', 15, lin(water, t.water, 0), `${fmtL(water)} / ${fmtL(t.water)}`, 'Wasser und alle Getränke (Kaffee, Tee, Saft, Milch …) zählen – Alkohol nicht. Am besten Wasser und ungesüßter Tee (DGE).'],
  ].map(([name, max, k, val, tip]) => ({ name, max, pts: Math.round(max * k * 10) / 10, val, tip }));
  const score = Math.round(parts.reduce((a, x) => a + x.pts, 0));
  // Wie viel der Kalorien haben Detail-Nährwerte? (Schnelleinträge haben keine)
  const coverage = s.kcal ? s.known / s.kcal : 1;
  return { score, parts, coverage, label: score >= 80 ? 'Sehr gut' : score >= 65 ? 'Gut' : score >= 45 ? 'Okay' : 'Ausbaufähig' };
}
export const fmtL = (ml) => `${String(Math.round(ml / 100) / 10).replace('.', ',')} L`;

/** Letzte 7 Tage (inkl. heute) für Diagramm und Schnitt; Tage ohne Eintrag zählen nicht zum Schnitt. */
export function lastDays(n = 7, today = new Date()) {
  const days = Array.from({ length: n }, (_, i) => {
    const ds = dateStr(addDays(today, i - n + 1));
    const s = sumOf(entriesOf(ds));
    return { ds, ...s, has: entriesOf(ds).length > 0 };
  });
  const logged = days.filter((d) => d.has);
  const avg = logged.length ? { kcal: Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length), p: Math.round(logged.reduce((a, d) => a + d.p, 0) / logged.length) } : null;
  return { days, avg, count: logged.length };
}

/** Zuletzt gegessen (für schnelles Wiederholen). */
export function recentFoods(limit = 8) {
  const out = [];
  for (let i = data.food.length - 1; i >= 0 && out.length < limit; i--) {
    const x = data.food[i];
    if (!x.ref || out.some((o) => o.name === x.name)) continue;
    out.push({ ...x.ref, name: x.name, lastG: x.g });
  }
  return out;
}

/** Lokale Suche (eigene Gerichte, zuletzt gegessen, eingebaute Liste, große Datenbank). */
export function searchLocal(q, opts = {}) {
  return searchFoods(q, opts);
}

// ---------- Online: Open Food Facts (kostenlos, offene Datenbank) ----------

/**
 * Packungsgröße aus Open Food Facts: { amount, liquid } – z. B. "500 ml", "0,5 l", "33 cl", "4 x 250 ml" (→ 250 je Flasche), "1 kg".
 */
export function packOf(p) {
  const conv = (v, u) => {
    u = String(u || '').toLowerCase().replace('ℓ', 'l');
    if (u === 'ml') return [v, true];
    if (u === 'cl') return [v * 10, true];
    if (u === 'dl') return [v * 100, true];
    if (u === 'l' || u === 'lt' || u === 'liter') return [v * 1000, true];
    if (u === 'g' || u === 'gr') return [v, false];
    if (u === 'kg') return [v * 1000, false];
    return null;
  };
  const q = String(p.quantity || '').toLowerCase().replace(/,/g, '.');
  // Mehrfachpackung: "4 x 250 ml" → eine Flasche
  const multi = q.match(/(\d+)\s*[x×*]\s*([\d.]+)\s*(ml|cl|dl|l|ℓ|g|kg)\b/);
  let r = multi ? conv(parseFloat(multi[2]), multi[3]) : null;
  if (!r) {
    const n = parseFloat(p.product_quantity);
    if (n > 0 && p.product_quantity_unit) r = conv(n, p.product_quantity_unit);
  }
  if (!r) { const m = q.match(/([\d.]+)\s*(ml|cl|dl|l|ℓ|lt|liter|g|gr|kg)\b/); if (m) r = conv(parseFloat(m[1]), m[2]); }
  if (!r && parseFloat(p.product_quantity) > 0) r = [parseFloat(p.product_quantity), null];
  if (!r || !(r[0] > 0) || r[0] > 10000) return { amount: null, liquid: null };
  return { amount: Math.round(r[0]), liquid: r[1] };
}

const isBeverage = (p) => (p.categories_tags || []).some((t) => /^en:(beverages|drinks|energy-drinks|sodas|waters|juices|plant-based-milks|milks)/.test(t));
const isAlcohol = (p) => (p.categories_tags || []).some((t) => /^en:(alcoholic-beverages|beers|wines|spirits|ciders|liqueurs)/.test(t))
  || Number(p.nutriments?.alcohol_100g || p.nutriments?.alcohol) > 0.5;

function fromOFF(p) {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : n['energy-kj_100g'] ? n['energy-kj_100g'] / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  const pk = packOf(p);
  const liquid = pk.liquid ?? isBeverage(p);
  const portion = parseFloat(p.serving_quantity) || (liquid && pk.amount) || 100;
  const g = (p.food_groups_tags || []).join(' ');
  const cat = /fruit-juices/.test(g) ? 'j' : /en:fruits/.test(g) ? 'o' : /en:vegetables|legumes/.test(g) ? 'v' : /milk-and-dairy/.test(g) ? 'd' : '';
  return {
    id: 'off:' + (p.code || p._id), name: `${p.product_name}${p.brands ? ` (${String(p.brands).split(',')[0]})` : ''}`.slice(0, 60),
    kcal: Math.round(kcal), p: r1(n.proteins_100g || 0), c: r1(n.carbohydrates_100g || 0), f: r1(n.fat_100g || 0),
    fib: r1(n.fiber_100g || 0), sug: r1(n.sugars_100g || 0), sat: r1(n['saturated-fat_100g'] || 0), cat,
    portion: Math.round(portion), unit: p.serving_quantity ? 'Portion' : liquid && pk.amount ? 'Flasche' : '100 g',
    ...(pk.amount ? { pack: pk.amount } : {}), ...(liquid ? { liquid: true } : {}), ...(liquid && isAlcohol(p) ? { alc: true } : {}),
  };
}

const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_quantity,food_groups_tags,quantity,product_quantity,product_quantity_unit,categories_tags';

/** Online: erst gemeinsame Datenbank der App, dann Open Food Facts. */
export async function searchOnline(q, signal) {
  const [mine, off] = await Promise.allSettled([communitySearch(q, signal), searchOFF(q, signal)]);
  if (mine.status === 'rejected' && off.status === 'rejected') throw off.reason;
  const a = mine.status === 'fulfilled' ? mine.value : [];
  const b = (off.status === 'fulfilled' ? off.value : []).filter((x) => !a.some((y) => y.code && y.code === String(x.id).replace('off:', '')));
  return [...a, ...b];
}

async function searchOFF(q, signal) {
  const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('Suche nicht erreichbar');
  const d = await r.json();
  return (d.products || []).map(fromOFF).filter(Boolean);
}

async function offByCode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`).catch(() => null);
  if (!r?.ok) return null;
  const d = await r.json().catch(() => null);
  return d?.product ? fromOFF({ ...d.product, code }) : null;
}

/**
 * Barcode nachschlagen: eigene Liste → gemeinsame Datenbank → Open Food Facts.
 * Gefundenes landet in deiner Liste und (falls neu) in der gemeinsamen Datenbank.
 * Rückgabe: Lebensmittel oder null (dann selbst anlegen).
 */
export async function byBarcode(code) {
  const own = myFoods().find((x) => x.code === code);
  if (own) return own;
  let f = await communityByCode(code);
  if (!f) {
    f = await offByCode(code);
    if (f) { f.code = code; communityAdd(f); }
  }
  return f ? saveMyFood({ ...f, code }) : null;
}

// ---------- Eigene Gerichte ----------

/** Summen eines Gerichts (gesamt) aus seinen Zutaten. */
export function mealTotals(meal) {
  const z = { g: 0, kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, sat: 0, freeSug: 0, veg: 0, fruit: 0 };
  for (const { food, g } of meal.items) {
    const k = g / 100;
    z.g += g; z.kcal += food.kcal * k; z.p += food.p * k; z.c += food.c * k; z.f += food.f * k;
    z.fib += (food.fib || 0) * k; z.sug += (food.sug || 0) * k; z.sat += (food.sat || 0) * k;
    if (!['o', 'v', 'd'].includes(food.cat)) z.freeSug += (food.sug || 0) * k;
    if (food.cat === 'v') z.veg += g;
    if (food.cat === 'o') z.fruit += g;
    if (food.cat === 'j') z.fruit += Math.min(g, 150) * 0.5;
  }
  return z;
}

/** Gericht als "Lebensmittel" (Werte je 100 g), damit es wie jedes andere eingetragen werden kann. */
export function mealAsFood(meal) {
  const t = mealTotals(meal);
  const per = (v) => (t.g ? r1((v / t.g) * 100) : 0);
  return {
    id: 'm:' + meal.id, mealId: meal.id, meal: true, name: meal.name,
    kcal: per(t.kcal), p: per(t.p), c: per(t.c), f: per(t.f), fib: per(t.fib), sug: per(t.sug), sat: per(t.sat),
    freeSugP: per(t.freeSug), vegP: per(t.veg), fruitP: per(t.fruit), cat: '',
    portion: Math.round(t.g / (meal.servings || 1)), unit: 'Portion', totalG: Math.round(t.g),
  };
}

export const meals = () => data.meals;

export function saveMeal(meal) {
  const m = { id: meal.id || uid(), name: meal.name.trim().slice(0, 40), servings: Math.max(1, Math.round(meal.servings || 1)), items: meal.items.map(({ food, g }) => ({ food: stripFood(food), g: Math.round(g) })) };
  const i = data.meals.findIndex((x) => x.id === m.id);
  if (i >= 0) data.meals[i] = m; else data.meals.push(m);
  save();
  return m;
}

export function deleteMeal(id) {
  data.meals = data.meals.filter((m) => m.id !== id);
  save();
}

/** Nur die Nährwerte speichern (keine Hilfsfelder). */
function stripFood(f) {
  const { id, name, kcal, p, c, f: fat, fib, sug, sat, cat, portion, unit, liquid, alc, code, pack } = f;
  return { id, name, kcal, p, c, f: fat, fib: fib || 0, sug: sug || 0, sat: sat || 0, cat: cat || '', portion: portion || 100, unit: unit || '100 g', ...(liquid ? { liquid: true } : {}), ...(alc ? { alc: true } : {}), ...(code ? { code } : {}), ...(pack > 0 ? { pack: Math.round(pack) } : {}) };
}

// ---------- Eigene Lebensmittel ----------
// Selbst angelegt (Nährwerte je 100 g eingetippt) → nur für dich.
// Mit Barcode (gescannt) → zusätzlich in der gemeinsamen Datenbank aller App-Nutzer.

export const myFoods = () => data.myFoods || [];

/** Speichern bzw. ändern. Rückgabe: gespeichertes Lebensmittel. */
export function saveMyFood(food) {
  const f = stripFood({ ...food, id: food.id && String(food.id).startsWith('u:') ? food.id : 'u:' + uid() });
  f.name = String(f.name).trim().slice(0, 60);
  f.mine = true;
  // gleicher Barcode bzw. gleiche ID ersetzen
  data.myFoods = myFoods().filter((x) => x.id !== f.id && !(f.code && x.code === f.code));
  data.myFoods.unshift(f);
  save();
  return f;
}

export function deleteMyFood(id) {
  data.myFoods = myFoods().filter((x) => x.id !== id);
  save();
}

/** Plausibel? (Werte je 100 g) – sonst Fehlertext. */
export function checkFood(f) {
  const n = (v) => Number(v) || 0;
  if (!f.name || f.name.trim().length < 2) return 'Name eingeben';
  if (n(f.kcal) <= 0 && n(f.p) + n(f.c) + n(f.f) <= 0) return 'Kalorien oder Nährwerte eingeben';
  if (n(f.kcal) > 900) return 'Mehr als 900 kcal pro 100 g gibt es nicht';
  if ([f.p, f.c, f.f, f.fib, f.sug, f.sat].some((v) => n(v) < 0 || n(v) > 100)) return 'Nährwerte je 100 g müssen zwischen 0 und 100 g liegen';
  if (n(f.p) + n(f.c) + n(f.f) + n(f.fib) > 101) return 'Protein + KH + Fett zusammen über 100 g – Werte je 100 g prüfen';
  if (n(f.sug) > n(f.c) + 0.5) return '„davon Zucker“ kann nicht mehr sein als Kohlenhydrate';
  if (n(f.sat) > n(f.f) + 0.5) return '„davon gesättigt“ kann nicht mehr sein als Fett';
  const calc = n(f.p) * 4 + n(f.c) * 4 + n(f.f) * 9 + n(f.fib) * 2;
  if (n(f.kcal) && calc && Math.abs(n(f.kcal) - calc) > Math.max(60, n(f.kcal) * 0.35)) return `Kalorien passen nicht zu den Nährwerten (daraus ergeben sich ca. ${Math.round(calc)} kcal) – Werte je 100 g prüfen`;
  return null;
}

// ---------- Gemeinsame Datenbank (Barcode-Produkte aller Nutzer, Push-Server) ----------

const API = () => (PUSH_SERVER || '').replace(/\/$/, '');
const myKey = () => {
  if (!data.profile.key) { data.profile.key = uid() + uid() + uid(); save(); }
  return data.profile.key;
};

export async function communityByCode(code) {
  if (!API()) return null;
  const r = await fetch(`${API()}/food/code/${encodeURIComponent(code)}`).catch(() => null);
  if (!r?.ok) return null;
  const f = await r.json().catch(() => null);
  return f?.name ? { ...f, id: 'g:' + code, code, shared: true } : null;
}

export async function communitySearch(q, signal) {
  if (!API()) return [];
  const r = await fetch(`${API()}/food/search?q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.items || []).map((f) => ({ ...f, id: 'g:' + f.code, shared: true }));
}

/** Produkt mit Barcode für alle bereitstellen (bestehende Einträge anderer bleiben unverändert). */
export async function communityAdd(food) {
  if (!API() || !/^\d{8,14}$/.test(food.code || '')) return false;
  const { name, kcal, p, c, f, fib, sug, sat, portion, unit, cat, liquid, code, pack } = stripFood(food);
  const caf = Number(food.caf) > 0 && Number(food.caf) <= 400 ? Number(food.caf) : undefined;
  const r = await fetch(`${API()}/food/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: myKey(), food: { name, kcal, p, c, f, fib, sug, sat, portion, unit, cat, liquid: !!liquid, code, ...(pack ? { pack } : {}), ...(caf ? { caf } : {}) } }),
  }).catch(() => null);
  return !!r?.ok;
}

// ---------- Große Datenbank: Schweizer Nährwertdatenbank (BLV, V 7.1) ----------
// 1.216 Grundlebensmittel und Gerichte, frei nutzbar mit Quellenangabe.
// Wird erst beim ersten Suchen geladen (ca. 110 KB) und offline gespeichert.

export const DB_SOURCE = 'Schweizer Nährwertdatenbank V 7.1 (01.07.2026), BLV – naehrwertdaten.ch';
let chDb = null;
let chLoading = null;

export function loadFoodDb() {
  if (chDb) return Promise.resolve(chDb);
  chLoading ||= fetch('data/foods-ch.json').then((r) => r.json()).then((d) => {
    chDb = d.items.map(([name, syn, kcal, p, c, f, fib, sug, sat, cat, portion, unit, liquid, alc]) => ({
      id: 'ch:' + name, name, syn, kcal, p, c, f, fib, sug, sat, cat, portion: liquid && unit === '100 g' ? 250 : portion, unit: liquid && unit === '100 g' ? 'Glas' : unit, liquid: !!liquid, ...(alc ? { alc: true } : {}), src: 'ch',
    }));
    return chDb;
  }).catch(() => { chLoading = null; return []; });
  return chLoading;
}
export const foodDbReady = () => !!chDb;

// Deutsche Suchwörter → Begriffe der Schweizer Datenbank
const SYN = {
  brokkoli: ['broccoli'], hahnchen: ['poulet', 'hahnchen'], huhnchen: ['poulet'], huhn: ['poulet', 'huhn'], chicken: ['poulet'],
  nudeln: ['teigwaren', 'nudel'], spaghetti: ['teigwaren', 'spaghetti'], pasta: ['teigwaren', 'pasta'], makkaroni: ['teigwaren'],
  pommes: ['frites', 'pommes'], sahne: ['vollrahm', 'halbrahm', 'schlagrahm', 'rahm'], schlagsahne: ['schlagrahm', 'vollrahm'], paprika: ['peperoni', 'paprika'],
  mohre: ['karotte'], mohren: ['karotte'], karotten: ['karotte'], kartoffelbrei: ['kartoffelstock'], kartoffelpuree: ['kartoffelstock'],
  wurstchen: ['wienerli', 'wurst'], croissant: ['gipfeli', 'croissant'], brotchen: ['brotli', 'brotchen', 'semmel'], semmel: ['brotli'],
  marmelade: ['konfiture'], eis: ['glace', 'rahmglace'], speiseeis: ['glace'], ei: ['ei', 'huhnerei'], eier: ['ei', 'huhnerei'], doner: ['kebab', 'doner'], hack: ['gehacktes', 'hack'], hackfleisch: ['gehacktes', 'hackfleisch'],
  pute: ['truthahn', 'pute'], putenbrust: ['truthahn', 'putenbrust'], walnuss: ['baumnuss', 'walnuss'], walnusse: ['baumnuss'],
  kichererbsen: ['kichererbse'], linsen: ['linse'], bohnen: ['bohne'], erbsen: ['erbse'], zucchini: ['zucchetti', 'zucchini'],
  pfannkuchen: ['omelette', 'pfannkuchen'], eierkuchen: ['omelette'], quark: ['quark'], magerquark: ['quark, nature, mager', 'magerquark'],
  frikadelle: ['hacktatschli', 'frikadelle'], blumenkohl: ['blumenkohl'], rosenkohl: ['rosenkohl'], porree: ['lauch'], lauch: ['lauch'],
  aprikose: ['aprikose'], pflaume: ['zwetschge', 'pflaume'], johannisbeere: ['johannisbeere'], schokolade: ['schokolade', 'schoggi'],
  ketchup: ['tomatenketchup', 'ketchup'], mayo: ['mayonnaise'], milchreis: ['milchreis'], gummibarchen: ['gummibonbon', 'gummibarchen'],
};

/** Für die Suche: klein, ohne Akzente/Umlautpunkte, ß → ss. */
export const norm = (t) => String(t).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Treffer-Punkte für einen Eintrag (0 = kein Treffer). Alle Suchwörter müssen passen. */
function score(food, words) {
  const name = norm(food.name);
  const hay = food.syn ? `${name} ${norm(food.syn)}` : name;
  const nameWords = name.split(/[^a-z0-9]+/).filter(Boolean);
  let total = 0;
  for (const w of words) {
    // Übersetzungen zuerst (z. B. sahne → vollrahm), sonst das Wort selbst
    const alts = SYN[w] ? [...SYN[w].filter((x) => x !== w), w] : [w];
    let best = 0, matches = 0;
    for (const [i, a] of alts.entries()) {
      const pri = -i * 0.3; // frühere Übersetzung leicht bevorzugt
      if (name.includes(a)) matches++;
      if (nameWords[0] === a) best = Math.max(best, 9 + pri);
      else if (nameWords.includes(a)) best = Math.max(best, 7 + pri);
      else if (name.startsWith(a)) best = Math.max(best, 6 + pri);
      else if (nameWords.some((x) => x.startsWith(a))) best = Math.max(best, 4 + pri);
      else if (name.includes(a)) best = Math.max(best, 2 + pri);
      else if (hay.includes(a)) best = Math.max(best, 1 + pri);
    }
    if (!best) return 0;
    total += best + Math.max(0, matches - 1) * 1.6; // passt zu mehreren Begriffen (Pommes + Frites)
  }
  // Kurze, einfache Namen zuerst ("Broccoli, roh" vor "Broccoli-Gratin mit ...")
  return total + Math.max(0, 3 - name.length / 25);
}

/** Durchsucht: eigene Gerichte, zuletzt gegessen, eingebaute Liste, große Datenbank. */
export function searchFoods(q, { withMeals = true, limit = 40 } = {}) {
  const words = norm(q).split(/[\s,]+/).filter(Boolean);
  const own = withMeals ? data.meals.map(mealAsFood) : [];
  const mine = myFoods();
  const recent = recentFoods(20).filter((r) => !String(r.id).startsWith('m:') && !own.some((m) => m.name === r.name) && !mine.some((m) => m.name === r.name));
  if (!words.length) return [...own, ...mine, ...recent, ...FOODS.filter((f) => !recent.some((r) => r.name === f.name))].slice(0, limit);
  const groups = [[own, 3], [mine, 3], [recent, 2], [FOODS, 1.5], [chDb || [], 0]];
  const seen = new Set();
  const hits = [];
  for (const [list, bonus] of groups) {
    for (const f of list) {
      if (seen.has(f.name)) continue;
      const sc = score(f, words);
      if (!sc) continue;
      seen.add(f.name);
      hits.push([sc + bonus, f]);
    }
  }
  return hits.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, f]) => f);
}
