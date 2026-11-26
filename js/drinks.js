// =============================================================
// drinks.js – Energy-Drink- und Koffein-Zähler
//
// Werte pro Dose/Flasche laut Hersteller (Deutschland, ca.). In der EU
// haben die meisten Energy-Drinks 32 mg Koffein pro 100 ml.
// Orientierung (EFSA): bis 400 mg Koffein pro Tag gelten für gesunde
// Erwachsene als unbedenklich, bis 200 mg auf einmal.
// =============================================================

import { data, save } from './store.js';
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
