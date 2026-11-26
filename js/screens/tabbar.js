// =============================================================
// tabbar.js – schwebende Tab-Leiste aus Glas (Training / Fortschritt /
// Ernährung / Freunde / Einstellungen). Tabs navigieren nur, sie lösen keine Aktionen aus.
// =============================================================

import { ICON } from './icons.js';

const TABS = [
  ['home', 'Training', ICON.dumbbell],
  ['progress', 'Fortschritt', ICON.chart],
  ['food', 'Ernährung', ICON.food],
  ['friends', 'Freunde', ICON.users],
  ['settings', 'Einstellungen', ICON.gear],
];

export function tabBar(current) {
  return `<nav class="tabbar" aria-label="Bereiche">${TABS.map(([k, label, icon]) =>
    `<button class="tab${k === current ? ' on' : ''}" data-action="tab" data-tab="${k}" ${k === current ? 'aria-current="page"' : ''}>
      ${icon}<span>${label}</span></button>`).join('')}</nav>`;
}
