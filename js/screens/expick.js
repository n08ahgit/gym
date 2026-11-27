// =============================================================
// expick.js – Übung auswählen (Suche im Sheet)
// Genutzt von „Rekord eintragen“ und „Training bearbeiten“.
// =============================================================

import { openSheet } from '../app.js';
import { esc } from '../util.js';
import { allExercises, muscleNames } from '../exercises.js';
import { searchExercises } from '../search.js';
import { ICON } from './icons.js';

function resultsHtml(q, exclude) {
  const res = searchExercises(q, allExercises()).filter((e) => !exclude.includes(e.id)).slice(0, 40);
  if (!res.length) return '<p class="muted center-text pad">Nichts gefunden.</p>';
  return res.map((e) => `<button class="result" data-action="pick" data-id="${esc(e.id)}">
      <span class="result-name">${esc(e.name)}${e.uni ? ' <span class="uni-tag">einseitig</span>' : ''}</span><span class="result-sub">${esc(muscleNames(e.primary))}</span></button>`).join('');
}

/**
 * Sheet mit Suchfeld + Ergebnisliste. onPick(exId) beim Antippen.
 * back = optionale Funktion für einen Zurück-Knopf (z. B. zurück zur Liste).
 */
export function openExercisePicker({ title = 'Übung wählen', sub = '', onPick, back = null, exclude = [] }) {
  openSheet(`<h2 class="sheet-title">${esc(title)}</h2>
    ${sub ? `<p class="muted small sheet-sub">${esc(sub)}</p>` : ''}
    <div class="search-bar in-sheet">${ICON.search}<input id="pickQ" class="input" type="search" data-input="q" placeholder="Suchen, z. B. Bankdrücken" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div>
    <div class="results pr-results" id="pickRes">${resultsHtml('', exclude)}</div>
    ${back ? '<div class="sheet-actions"><button class="btn ghost big" data-action="back">Zurück</button></div>' : ''}`, {
    inputs: { q: (el) => { const r = document.getElementById('pickRes'); r.innerHTML = resultsHtml(el.value, exclude); r.scrollTop = 0; } },
    pick: (el) => onPick(el.dataset.id),
    back: () => back?.(),
  });
  setTimeout(() => document.getElementById('pickQ')?.focus(), 350);
}
