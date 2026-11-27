// =============================================================
// drinks.js – Energy-Drink- und Koffein-Zähler
//
// Werte pro Dose/Flasche laut Hersteller (Deutschland, ca.). In der EU
// haben die meisten Energy-Drinks 32 mg Koffein pro 100 ml.
// Orientierung (EFSA): bis 400 mg Koffein pro Tag gelten für gesunde
// Erwachsene als unbedenklich, bis 200 mg auf einmal.
// =============================================================

import { data, save } from './store.js';
import { communityByCode, communityAdd, packOf, logFood, removeFood } from './nutrition.js';
import { addDays, dateStr, uid } from './util.js';

export const DAILY_LIMIT = 400;

// Nährwerte je 100 ml nur, wo sicher (Etikett): [kcal, KH, Zucker]. Sonst fragt die App einmal nach.
const N_RB = [46, 11, 11];       // Red Bull: 46 kcal, 11 g KH, 11 g Zucker
const N_MONSTER = [48, 12, 11];  // Monster Energy (grün)
// prettier-ignore
export const DRINKS = [
  ['monster', 'Monster Energy', 500, 160, N_MONSTER],
  ['monster_ultra', 'Monster Ultra', 500, 160],
  ['redbull', 'Red Bull', 250, 80, N_RB],
  ['redbull_355', 'Red Bull (355 ml)', 355, 114, N_RB],
  ['redbull_473', 'Red Bull (473 ml)', 473, 151, N_RB],
  ['rockstar', 'Rockstar', 500, 160],
  ['effect', 'Effect', 330, 106],
  ['effect_500', 'Effect (500 ml)', 500, 160],
  ['hell', 'Hell Energy', 250, 80],
  ['booster', 'Booster', 500, 160],
  ['28black', '28 Black', 250, 80],
  ['reign', 'Reign', 500, 160],
  ['nocco', 'Nocco BCAA', 330, 180],
  ['clubmate', 'Club-Mate', 500, 100, [20, 5, 5]],
  ['coffee', 'Kaffee (Tasse, schwarz)', 200, 90, [2, 0, 0]],
  ['espresso', 'Espresso', 30, 65, [2, 0, 0]],
].map(([id, name, ml, mg, n]) => ({ id, name, ml, mg, ...(n ? { nutr: { kcal: n[0], c: n[1], sug: n[2] } } : {}) }));

/** Nährwerte je 100 ml eines Drinks: fest hinterlegt, selbst eingetragen oder beim Scan gelernt. */
export const nutrOf = (d) => d.nutr || data.drinkNutr?.[d.id] || data.drinkNutr?.[d.name] || null;
export function setDrinkNutr(key, nutr) {
  data.drinkNutr = { ...(data.drinkNutr || {}), [key]: nutr };
  save();
}

// ---------- Dose scannen ----------
// Reihenfolge: schon mal gescannt (eigene Liste) → gemeinsame Datenbank → Open Food Facts.
// Koffein steht dort nicht immer → Vorschlag 32 mg/100 ml (EU-üblich), Nutzer bestätigt.

export const TYPICAL_MG_100 = 32;
export const myDrinks = () => data.myDrinks || [];

/** ml der gescannten Flasche/Dose ("500 ml", "0,5 l", "33 cl", "4 x 250 ml" → 250). */
export function parseMl(p) {
  const pk = packOf(p);
  return pk.amount && pk.liquid !== false ? pk.amount : null;
}

/** Nährwerte je 100 ml aus Open Food Facts. */
function nutrFromOFF(n = {}) {
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (kcal == null) return null;
  const r = (v) => Math.round((Number(v) || 0) * 10) / 10;
  return { kcal: Math.round(kcal), c: r(n.carbohydrates_100g), sug: r(n.sugars_100g), p: r(n.proteins_100g), f: r(n.fat_100g) };
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
  const sharedNutr = shared ? { kcal: shared.kcal, c: shared.c, sug: shared.sug, p: shared.p, f: shared.f } : null;
  if (shared?.caf) {
    const ml = shared.pack || shared.portion || 500;
    return { code, name: shared.name, ml, caf: shared.caf, mg: Math.round(shared.caf * ml / 100), known: true, source: 'shared', nutr: sharedNutr };
  }
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,categories_tags`);
    const d = r.ok ? await r.json() : null;
    const p = d?.product;
    if (p?.product_name) {
      const ml = parseMl(p) || shared?.pack || null;
      const caf = cafPer100(p.nutriments);
      const name = `${p.product_name}${p.brands && !p.product_name.toLowerCase().includes(String(p.brands).split(',')[0].toLowerCase()) ? ` (${String(p.brands).split(',')[0]})` : ''}`.slice(0, 40);
      return { code, name, ml, caf: caf ?? TYPICAL_MG_100, mg: ml ? Math.round((caf ?? TYPICAL_MG_100) * ml / 100) : null, known: !!caf, source: 'off', nutr: nutrFromOFF(p.nutriments) || sharedNutr, offNutr: p.nutriments };
    }
  } catch { /* offline */ }
  if (shared) { const ml = shared.pack || null; return { code, name: shared.name, ml, caf: TYPICAL_MG_100, mg: ml ? Math.round(TYPICAL_MG_100 * ml / 100) : null, known: false, source: 'shared', nutr: sharedNutr }; }
  return null;
}

/** Gescannte Dose merken (+ mit Koffein in die gemeinsame Datenbank, falls Nährwerte bekannt). */
export function rememberDrink(d) {
  const e = { code: d.code, name: String(d.name).slice(0, 40), ml: Math.round(d.ml) || null, mg: Math.round(d.mg), ...(d.nutr ? { nutr: d.nutr } : {}) };
  data.myDrinks = [e, ...myDrinks().filter((x) => x.code !== d.code)].slice(0, 200);
  save();
  if (d.nutr && e.ml) {
    const n = d.nutr;
    communityAdd({ code: d.code, name: e.name, kcal: n.kcal || 0, p: n.p || 0, c: n.c || 0, f: n.f || 0, sug: n.sug || 0, portion: e.ml, pack: e.ml, unit: 'Flasche', liquid: true, caf: Math.round(e.mg / e.ml * 1000) / 10 }).catch(() => {});
  }
  return e;
}

/** Getränk eintragen. */
// Zählt doppelt: Koffein (Freunde) UND Kalorien (Ernährung), wenn die Nährwerte bekannt sind.
export function logDrink(d) {
  const n = d.nutr || nutrOf(d);
  let foodId = null;
  if (n && d.ml) {
    const fe = logFood({ id: 'drink:' + (d.id || d.name), name: d.name, kcal: n.kcal || 0, p: n.p || 0, c: n.c || 0, f: n.f || 0, sug: n.sug || 0, portion: d.ml, pack: d.ml, unit: 'Flasche', liquid: true, cat: '' }, d.ml);
    foodId = fe.id;
  }
  data.drinks.push({ id: uid(), t: Date.now(), date: dateStr(), key: d.id || 'custom', name: d.name, ml: d.ml || null, mg: d.mg, ...(n ? { n } : {}), ...(foodId ? { foodId } : {}) });
  save();
  return { kcal: n && d.ml ? Math.round((n.kcal || 0) * d.ml / 100) : null };
}

export function removeDrink(id) {
  const x = data.drinks.find((d) => d.id === id);
  if (x?.foodId) removeFood(x.foodId); // auch aus dem Kalorienrechner
  data.drinks = data.drinks.filter((d) => d.id !== id);
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
    if (!recent.some((r) => r.name === x.name)) recent.push(DRINKS.find((d) => d.id === x.key) || { id: x.key || 'custom', name: x.name, ml: x.ml, mg: x.mg, ...(x.n ? { nutr: x.n } : {}) });
  }
  return { recent, all: DRINKS };
}
