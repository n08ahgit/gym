// =============================================================
// bodyimage.js – Körperbild mit markierten Muskeln
//
// img/body/base.webp  = ein Grundbild (vorne + hinten, graue Muskeln),
//                       erzeugt mit dem OpenAI-Bildmodell
// img/body/<key>.png  = eine Maske pro Muskelgruppe (Alpha = Muskel),
//                       aus einer KI-Bearbeitung desselben Bildes
//                       ausgeschnitten → sitzt pixelgenau.
//
// Pro Übung werden die Masken der Haupt-/Hilfsmuskeln als farbige
// Ebenen mit "multiply" über das Grundbild gelegt: Die Farbe kommt dazu,
// Fasern und Licht bleiben sichtbar.
// Neue Muskelgruppe: Maske in img/body/ ablegen, Schlüssel hier eintragen,
// Datei in sw.js aufnehmen.
// =============================================================

import { muscleNames } from './exercises.js';

export const BODY_GROUPS = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
  'traps', 'upper_back', 'lats', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves',
];

const layers = (keys, cls) =>
  keys
    .filter((k) => BODY_GROUPS.includes(k))
    // Maske direkt am Element: so wird die URL relativ zur Seite aufgelöst
    .map((k) => `<span class="hl ${cls}" style="-webkit-mask-image:url(img/body/${k}.png);mask-image:url(img/body/${k}.png)"></span>`)
    .join('');

/** Körperbild für eine Übung. */
export function bodyImage(primary = [], secondary = []) {
  const sec = secondary.filter((k) => !primary.includes(k));
  const label = `Trainierte Muskeln: ${muscleNames(primary)}${sec.length ? `; mit: ${muscleNames(sec)}` : ''}`;
  return `<div class="body-img" role="img" aria-label="${label}">
    <img src="img/body/base.webp" alt="" width="1050" height="918" decoding="async">
    ${layers(sec, 'sec')}${layers(primary, 'pri')}
  </div>`;
}

/**
 * Muskelbalance: alle Gruppen in einer Farbe, Deckkraft nach Anzahl Sätzen
 * (sequenziell: wenig = blass, viel = kräftig). tally = { key: Sätze }.
 */
export function bodyHeat(tally) {
  const max = Math.max(0, ...Object.values(tally));
  const spans = BODY_GROUPS.filter((k) => tally[k] > 0)
    .map((k) => {
      const op = (0.18 + 0.82 * (tally[k] / max)).toFixed(2);
      return `<span class="hl pri" style="opacity:${op};-webkit-mask-image:url(img/body/${k}.png);mask-image:url(img/body/${k}.png)"></span>`;
    })
    .join('');
  return `<div class="body-img" role="img" aria-label="Muskelbalance als Körperbild, Details in der Liste darunter">
    <img src="img/body/base.webp" alt="" width="1050" height="918" decoding="async">${spans}</div>`;
}
