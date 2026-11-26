// =============================================================
// nutrition.js – Kalorien & Makros: Ziele, Einträge, Lebensmittel
//
// Ziel-Berechnung (Stand der Forschung):
// - Grundumsatz nach Mifflin-St Jeor (genaueste Formel ohne Messung).
// - Gesamtbedarf = Grundumsatz × Aktivitätsfaktor.
// - Aufbau: +10 % (≈ +250–350 kcal) → ca. +0,25–0,5 % Körpergewicht/Woche
//   (Iraki et al. 2019). Diät: −20 % → ca. 0,5–1 %/Woche, Muskeln bleiben.
// - Protein: 1,6–2,2 g/kg reichen für maximalen Muskelaufbau (Morton et al.
//   2018); hier 1,8 g/kg (Aufbau/Halten) bzw. 2,2 g/kg (Diät).
// - Fett mind. ~0,8 g/kg (Hormone), Rest Kohlenhydrate (Trainingsleistung).
// Nährwerte der eingebauten Liste: Durchschnittswerte pro 100 g (ca.).
// =============================================================

import { data, save } from './store.js';
import { addDays, dateStr, uid } from './util.js';
import { bodyTrend } from './coach.js';

export const ACTIVITY = [
  [1.4, 'Wenig', 'Bürojob/Schule, 1–2× Training'],
  [1.55, 'Normal', '3–4× Training pro Woche'],
  [1.7, 'Viel', '5–6× Training oder Training + Sport'],
  [1.9, 'Sehr viel', 'Täglich hart + körperliche Arbeit'],
];
export const GOALS = { bulk: ['Aufbau', 1.1, 1.8], keep: ['Halten', 1.0, 1.8], cut: ['Diät', 0.8, 2.2] };

// prettier-ignore
// [Name, kcal, Protein, Kohlenhydrate, Fett (je 100 g), Portion in g, Portions-Name]
const RAW = [
  ['Haferflocken', 370, 13.5, 59, 7, 60, 'Portion'], ['Reis (gekocht)', 130, 2.7, 28, 0.3, 200, 'Teller'],
  ['Reis (roh)', 350, 7, 78, 0.6, 80, 'Portion'], ['Nudeln (gekocht)', 150, 5.5, 29, 0.9, 250, 'Teller'],
  ['Nudeln (roh)', 360, 12, 72, 1.5, 100, 'Portion'], ['Kartoffeln (gekocht)', 72, 2, 15, 0.1, 250, 'Portion'],
  ['Süßkartoffel', 86, 1.6, 20, 0.1, 200, 'Stück'], ['Vollkornbrot', 220, 7.5, 40, 1.5, 50, 'Scheibe'],
  ['Toastbrot', 260, 8, 48, 3.5, 25, 'Scheibe'], ['Brötchen', 270, 9, 53, 1.5, 60, 'Stück'],
  ['Hähnchenbrust (roh)', 105, 23, 0, 1.2, 200, 'Portion'], ['Hähnchenbrust (gebraten)', 150, 30, 0, 3, 150, 'Portion'],
  ['Putenbrust', 107, 24, 0, 1, 150, 'Portion'], ['Rinderhack', 250, 18, 0, 20, 125, 'Portion'],
  ['Rindersteak', 140, 22, 0, 5, 200, 'Steak'], ['Lachs', 200, 20, 0, 13, 125, 'Filet'],
  ['Thunfisch (Dose, Wasser)', 110, 25, 0, 1, 130, 'Dose'], ['Ei', 155, 13, 1, 11, 60, 'Stück'],
  ['Eiklar', 48, 11, 0.7, 0.2, 100, 'Portion'], ['Magerquark', 67, 12, 4, 0.2, 250, 'Becher'],
  ['Skyr', 63, 11, 4, 0.2, 150, 'Becher'], ['Hüttenkäse', 100, 12, 3, 4.5, 200, 'Becher'],
  ['Griechischer Joghurt', 120, 4, 4, 10, 150, 'Portion'], ['Milch 1,5 %', 47, 3.4, 4.8, 1.5, 250, 'Glas'],
  ['Gouda', 360, 25, 0, 28, 30, 'Scheibe'], ['Mozzarella', 250, 18, 1, 19, 125, 'Kugel'],
  ['Whey-Protein (Pulver)', 380, 75, 8, 6, 30, 'Shake'], ['Tofu', 120, 13, 1.5, 7, 200, 'Packung'],
  ['Linsen (gekocht)', 115, 9, 17, 0.4, 200, 'Portion'], ['Kichererbsen (gekocht)', 140, 8, 20, 2.5, 150, 'Portion'],
  ['Banane', 95, 1.1, 21, 0.3, 120, 'Stück'], ['Apfel', 52, 0.3, 11.4, 0.2, 150, 'Stück'],
  ['Beeren (TK)', 45, 1, 8, 0.4, 150, 'Portion'], ['Brokkoli', 34, 2.8, 4, 0.4, 200, 'Portion'],
  ['Gemüse gemischt', 40, 2, 6, 0.4, 200, 'Portion'], ['Avocado', 160, 2, 2, 15, 80, 'Hälfte'],
  ['Erdnussbutter', 600, 25, 13, 50, 20, 'Löffel'], ['Mandeln', 600, 21, 6, 52, 30, 'Handvoll'],
  ['Olivenöl', 884, 0, 0, 100, 10, 'Esslöffel'], ['Butter', 740, 0.7, 0.6, 82, 10, 'Portion'],
  ['Honig', 305, 0.4, 76, 0, 20, 'Löffel'], ['Reiswaffel', 380, 8, 80, 3, 8, 'Stück'],
  ['Pizza (TK)', 250, 10, 30, 10, 350, 'Pizza'], ['Döner', 215, 12, 20, 10, 350, 'Stück'],
  ['Pommes', 290, 3.5, 36, 15, 150, 'Portion'], ['Burger', 250, 13, 24, 11, 250, 'Stück'],
  ['Schokolade', 540, 6, 57, 31, 25, 'Riegel'], ['Proteinriegel', 360, 33, 35, 10, 60, 'Riegel'],
  ['Cola', 42, 0, 10.6, 0, 330, 'Dose'], ['Orangensaft', 45, 0.7, 10, 0.2, 250, 'Glas'],
];
export const FOODS = RAW.map(([name, kcal, p, c, f, portion, unit]) => ({ id: 'b:' + name, name, kcal, p, c, f, portion, unit }));

// ---------- Ziele ----------

export const profile = () => data.nutrition || {};

/** Aktuelles Körpergewicht: 7-Tage-Schnitt aus dem Gewichtsverlauf, sonst Eingabe. */
export function weightNow() {
  const t = bodyTrend();
  return t ? t.current : profile().weight || null;
}

/** Tagesziel { kcal, p, c, f, bmr, tdee } oder null, wenn Angaben fehlen. */
export function targets() {
  const n = profile();
  const w = weightNow();
  if (!w || !n.height || !n.age || !n.sex) return null;
  const bmr = 10 * w + 6.25 * n.height - 5 * n.age + (n.sex === 'f' ? -161 : 5);
  const tdee = bmr * (n.activity || 1.55);
  const [, factor, protPerKg] = GOALS[n.goal || 'bulk'];
  let kcal = Math.round((tdee * factor + (n.adjust || 0)) / 10) * 10;
  if (n.kcal) kcal = n.kcal; // feste Vorgabe überschreibt die Formel
  const p = Math.round(w * protPerKg);
  const f = Math.round(Math.max(w * 0.8, (kcal * 0.25) / 9));
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal, p, c, f, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

/** Vorschlag anhand des Gewichtsverlaufs: zu schnell/zu langsam? */
export function adjustHint() {
  const t = bodyTrend();
  const goal = profile().goal || 'bulk';
  if (!t || t.pct == null) return null;
  const pct = t.pct;
  if (goal === 'bulk' && pct < 0.15) return { delta: 150, text: `Dein Gewicht steigt kaum (${fmtPct(pct)}/Woche). Für Aufbau ca. +150 kcal pro Tag.` };
  if (goal === 'bulk' && pct > 0.6) return { delta: -150, text: `Du nimmst schnell zu (${fmtPct(pct)}/Woche) – dabei kommt vor allem Fett dazu. Ca. −150 kcal pro Tag.` };
  if (goal === 'cut' && pct > -0.4) return { delta: -150, text: `Du nimmst kaum ab (${fmtPct(pct)}/Woche). Ca. −150 kcal pro Tag.` };
  if (goal === 'cut' && pct < -1.0) return { delta: 150, text: `Du nimmst sehr schnell ab (${fmtPct(pct)}/Woche) – Muskeln in Gefahr. Ca. +150 kcal pro Tag.` };
  if (goal === 'keep' && Math.abs(pct) > 0.25) return { delta: pct > 0 ? -100 : 100, text: `Dein Gewicht verändert sich (${fmtPct(pct)}/Woche). Ca. ${pct > 0 ? '−' : '+'}100 kcal pro Tag.` };
  return null;
}
const fmtPct = (v) => `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v * 100) / 100).toString().replace('.', ',')} %`;

export function saveProfile(patch) {
  data.nutrition = { ...profile(), ...patch };
  save();
}

// ---------- Einträge ----------

/** Eintrag aus Lebensmittel (Werte je 100 g) und Menge in g. */
export function logFood(food, grams) {
  const k = grams / 100;
  const e = {
    id: uid(), t: Date.now(), date: dateStr(), name: food.name, g: Math.round(grams),
    kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k),
    ref: { id: food.id, kcal: food.kcal, p: food.p, c: food.c, f: food.f, portion: food.portion, unit: food.unit },
  };
  data.food.push(e);
  save();
  return e;
}

/** Schnell eintragen: nur kcal (+ Protein). */
export function logQuick(name, kcal, p = 0) {
  const e = { id: uid(), t: Date.now(), date: dateStr(), name: name || 'Schnell eingetragen', kcal: Math.round(kcal), p: r1(p), c: 0, f: 0 };
  data.food.push(e);
  save();
  return e;
}

export function removeFood(id) {
  data.food = data.food.filter((x) => x.id !== id);
  save();
}

const r1 = (v) => Math.round(v * 10) / 10;

export const entriesOf = (ds) => data.food.filter((x) => x.date === ds);

export function sumOf(list) {
  return list.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + (x.p || 0), c: a.c + (x.c || 0), f: a.f + (x.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
}

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

/** Lokale Suche (eingebaute Liste + zuletzt gegessen). */
export function searchLocal(q) {
  const s = q.trim().toLowerCase();
  const recent = recentFoods(20);
  const all = [...recent, ...FOODS.filter((f) => !recent.some((r) => r.name === f.name))];
  if (!s) return all.slice(0, 30);
  return all.filter((f) => f.name.toLowerCase().includes(s)).slice(0, 30);
}

// ---------- Online: Open Food Facts (kostenlos, offene Datenbank) ----------

function fromOFF(p) {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  const portion = parseFloat(p.serving_quantity) || 100;
  return {
    id: 'off:' + (p.code || p._id), name: `${p.product_name}${p.brands ? ` (${String(p.brands).split(',')[0]})` : ''}`.slice(0, 60),
    kcal: Math.round(kcal), p: r1(n.proteins_100g || 0), c: r1(n.carbohydrates_100g || 0), f: r1(n.fat_100g || 0),
    portion: Math.round(portion), unit: p.serving_quantity ? 'Portion' : '100 g',
  };
}

const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_quantity';

export async function searchOnline(q, signal) {
  const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('Suche nicht erreichbar');
  const d = await r.json();
  return (d.products || []).map(fromOFF).filter(Boolean);
}

export async function byBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.product ? fromOFF({ ...d.product, code }) : null;
}
