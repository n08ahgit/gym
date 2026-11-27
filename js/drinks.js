// =============================================================
// drinks.js – Energy-Drink- und Koffein-Zähler
//
// Werte pro Dose/Flasche laut Hersteller (Deutschland, ca.). In der EU
// haben die meisten Energy-Drinks 32 mg Koffein pro 100 ml.
// Orientierung (EFSA): bis 400 mg Koffein pro Tag gelten für gesunde
// Erwachsene als unbedenklich, bis 200 mg auf einmal.
// =============================================================

import { data, save } from './store.js';
import { communityByCode, communityAdd } from './nutrition.js';
import { addDays, dateStr, uid } from './util.js';

export const DAILY_LIMIT = 400;

// prettier-ignore
export const DRINKS = [
  ['monster', 'Monster Energy', 500, 160],
  ['monster_ultra', 'Monster Ultra', 500, 160],
  ['redbull', 'Red Bull', 250, 80],
  ['redbull_355', 'Red Bull (355 ml)', 355, 114],
  ['redbull_473', 'Red Bull (473 ml)', 473, 151],
  ['rockstar', 'Rockstar', 500, 160],
  ['effect', 'Effect', 330, 106],
  ['effect_500', 'Effect (500 ml)', 500, 160],
  ['hell', 'Hell Energy', 250, 80],
  ['booster', 'Booster', 500, 160],
  ['28black', '28 Black', 250, 80],
  ['reign', 'Reign', 500, 160],
  ['nocco', 'Nocco BCAA', 330, 180],
  ['clubmate', 'Club-Mate', 500, 100],
  ['coffee', 'Kaffee (Tasse)', 200, 90],
  ['espresso', 'Espresso', 30, 65],
].map(([id, name, ml, mg]) => ({ id, name, ml, mg }));

// ---------- Dose scannen ----------
// Reihenfolge: schon mal gescannt (eigene Liste) → gemeinsame Datenbank → Open Food Facts.
// Koffein steht dort nicht immer → Vorschlag 32 mg/100 ml (EU-üblich), Nutzer bestätigt.

export const TYPICAL_MG_100 = 32;
export const myDrinks = () => data.myDrinks || [];

/** ml aus Open-Food-Facts-Angaben ("500 ml", "0,5 l", "25 cl"). */
export function parseMl(p) {
  const n = parseFloat(p.product_quantity);
  const unit = String(p.product_quantity_unit || '').toLowerCase();
  if (n > 0 && (unit === 'ml' || unit === '')) return Math.round(n);
  const m = String(p.quantity || '').toLowerCase().replace(',', '.').match(/([\d.]+)\s*(ml|cl|l)\b/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Math.round(m[2] === 'l' ? v * 1000 : m[2] === 'cl' ? v * 10 : v);
}

/** Koffein (mg je 100 ml) aus Open Food Facts – dort meist in g angegeben. */
export function cafPer100(nutr = {}) {
  const v = Number(nutr.caffeine_100g ?? nutr.caffeine_100ml);
  if (!(v > 0)) return null;
  const mg = v < 1 ? v * 1000 : v; // 0,032 g → 32 mg; manche Einträge schon in mg
  return mg > 0 && mg <= 400 ? Math.round(mg * 10) / 10 : null;
}

/** Barcode → { code, name, ml, mg, caf, known } (known = Koffein sicher bekannt) */
export async function drinkByCode(code) {
  const mine = myDrinks().find((x) => x.code === code);
  if (mine) return { ...mine, known: true, source: 'mine' };
  const shared = await communityByCode(code).catch(() => null);
  if (shared?.caf) {
    const ml = shared.portion || 500;
    return { code, name: shared.name, ml, caf: shared.caf, mg: Math.round(shared.caf * ml / 100), known: true, source: 'shared' };
  }
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,product_quantity,product_quantity_unit,nutriments`);
    const d = r.ok ? await r.json() : null;
    const p = d?.product;
    if (p?.product_name) {
      const ml = parseMl(p) || shared?.portion || 500;
      const caf = cafPer100(p.nutriments);
      const name = `${p.product_name}${p.brands && !p.product_name.toLowerCase().includes(String(p.brands).split(',')[0].toLowerCase()) ? ` (${String(p.brands).split(',')[0]})` : ''}`.slice(0, 40);
      return { code, name, ml, caf: caf ?? TYPICAL_MG_100, mg: Math.round((caf ?? TYPICAL_MG_100) * ml / 100), known: !!caf, source: 'off', kcal: p.nutriments?.['energy-kcal_100g'], nutr: p.nutriments };
    }
  } catch { /* offline */ }
  if (shared) return { code, name: shared.name, ml: shared.portion || 500, caf: TYPICAL_MG_100, mg: Math.round(TYPICAL_MG_100 * (shared.portion || 500) / 100), known: false, source: 'shared' };
  return null;
}

/** Gescannte Dose merken (+ mit Koffein in die gemeinsame Datenbank, falls Nährwerte bekannt). */
export function rememberDrink(d) {
  const e = { code: d.code, name: String(d.name).slice(0, 40), ml: Math.round(d.ml) || null, mg: Math.round(d.mg) };
  data.myDrinks = [e, ...myDrinks().filter((x) => x.code !== d.code)].slice(0, 200);
  save();
  if (d.nutr && d.ml) {
    const n = d.nutr;
    communityAdd({ code: d.code, name: e.name, kcal: n['energy-kcal_100g'] || 0, p: n.proteins_100g || 0, c: n.carbohydrates_100g || 0, f: n.fat_100g || 0, sug: n.sugars_100g || 0, sat: n['saturated-fat_100g'] || 0, fib: n.fiber_100g || 0, portion: e.ml, unit: 'Dose', liquid: true, caf: Math.round(e.mg / e.ml * 1000) / 10 }).catch(() => {});
  }
  return e;
}

/** Getränk eintragen. */
export function logDrink(d) {
  data.drinks.push({ id: uid(), t: Date.now(), date: dateStr(), key: d.id || 'custom', name: d.name, ml: d.ml || null, mg: d.mg });
  save();
}

export function removeDrink(id) {
  data.drinks = data.drinks.filter((x) => x.id !== id);
  save();
}

export const todayDrinks = () => data.drinks.filter((x) => x.date === dateStr());
export const mgOf = (list) => list.reduce((a, x) => a + (x.mg || 0), 0);

/** Koffein der letzten n Tage (inkl. heute) + Lieblings-Drinks. */
export function caffeineStats(days = 7, today = new Date()) {
  const from = dateStr(addDays(today, -(days - 1)));
  const list = data.drinks.filter((x) => x.date >= from);
  const count = {};
  for (const x of list) count[x.name] = (count[x.name] || 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { mg: mgOf(list), n: list.length, top };
}

/** Zuletzt benutzte Drinks zuerst (für schnelles Eintragen). */
export function drinkChoices() {
  const recent = [];
  for (let i = data.drinks.length - 1; i >= 0 && recent.length < 3; i--) {
    const x = data.drinks[i];
    if (!recent.some((r) => r.name === x.name)) recent.push(DRINKS.find((d) => d.id === x.key) || { id: 'custom', name: x.name, ml: x.ml, mg: x.mg });
  }
  return { recent, all: DRINKS };
}
