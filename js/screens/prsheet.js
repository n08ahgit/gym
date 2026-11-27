// =============================================================
// prsheet.js – Rekord selbst eintragen / ändern / löschen
//
// Für Bestwerte, die nicht aus einem App-Workout kommen (z. B. von vor
// der App oder ein Maximaltest). Zählt überall als Bestwert: Kraft,
// Rekorde, Rekord-Erkennung im Workout und Freunde-Rangliste.
// =============================================================

import { openSheet, closeSheet, render, toast } from '../app.js';
import { data, exUnit, savePr, deletePr } from '../store.js';
import { esc, fmtNum, dateStr, parseNum, fmtWU, toU, fromU, fmtDateLong } from '../util.js';
import { getExercise } from '../exercises.js';
import { openExercisePicker } from './expick.js';
import { perDumbbell } from '../coach.js';
import { e1rm } from '../stats.js';
import { ICON } from './icons.js';

/** Schritt 1: Übung wählen. */
function openPicker(onDone) {
  openExercisePicker({ title: 'Rekord eintragen', sub: 'Welche Übung?', onPick: (id) => openPrSheet({ exId: id, onDone, canChange: true }) });
}

/**
 * Rekord-Formular. Ohne exId zuerst die Übungsauswahl.
 * pr = bestehender Eintrag zum Ändern. onDone wird nach Speichern/Löschen aufgerufen.
 */
export function openPrSheet({ exId = null, pr = null, onDone = null, canChange = false } = {}) {
  if (pr) exId = pr.exId;
  if (!exId) return openPicker(onDone);
  const ex = getExercise(exId);
  const u = exUnit(exId);
  const pd = perDumbbell(exId);
  const today = dateStr();
  const wVal = pr ? fmtNum(Math.round(toU(pr.w, u) * 100) / 100) : '';
  const est = () => {
    const w = fromU(parseNum(document.getElementById('prW')?.value), u), r = parseInt(document.getElementById('prR')?.value, 10);
    const el = document.getElementById('prEst');
    if (!el) return;
    el.textContent = w > 0 && r > 1 ? `≈ ${fmtWU(Math.round(e1rm(w, r) * 2) / 2, u)} geschätztes Maximum (1 Wdh)` : w > 0 && r === 1 ? 'Maximum bei 1 Wiederholung' : '';
  };
  openSheet(`<h2 class="sheet-title">${pr ? 'Rekord ändern' : 'Rekord eintragen'}</h2>
    ${canChange ? `<button class="list-row pr-ex" data-action="change"><span class="lr-main"><span class="lr-title">${esc(ex?.name || 'Übung')}</span><span class="lr-sub">Übung ändern</span></span><span class="chev">${ICON.chev}</span></button>`
      : `<p class="pr-ex-name">${esc(ex?.name || 'Übung')}</p>`}
    <div class="two">
      <label class="gfield"><span>Gewicht (${u}${pd ? ' pro Hantel' : ''})</span><input id="prW" inputmode="decimal" value="${wVal}" placeholder="${u === 'lb' ? '225' : '100'}" autocomplete="off" data-input="calc" data-enter="save"></label>
      <label class="gfield"><span>Wiederholungen</span><input id="prR" inputmode="numeric" value="${pr ? pr.r : 1}" autocomplete="off" data-input="calc" data-enter="save"></label>
    </div>
    <label class="gfield"><span>Datum</span><input id="prD" type="date" value="${pr ? pr.date : today}" max="${today}"></label>
    <p class="muted small pr-est" id="prEst"></p>
    <p class="muted small">Zählt als Bestwert – auch für die Rekord-Erkennung im Workout und die Freunde-Rangliste.</p>
    <div class="sheet-actions">
      <button class="btn primary big" data-action="save">Speichern</button>
      ${pr ? '<button class="btn ghost big danger" data-action="del">Rekord löschen</button>' : ''}
    </div>`, {
    inputs: { calc: est },
    change: () => openPicker(onDone),
    save: () => {
      const w = fromU(parseNum(document.getElementById('prW').value), u);
      const r = parseInt(document.getElementById('prR').value, 10);
      const d = document.getElementById('prD').value || today;
      if (!(w > 0) || w >= 1000) return toast('Bitte ein Gewicht eingeben');
      if (!(r >= 1 && r <= 50)) return toast('Wiederholungen: 1 bis 50');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) return toast('Datum darf nicht in der Zukunft liegen');
      savePr({ id: pr?.id, exId, w: Math.round(w * 100) / 100, r, date: d });
      closeSheet();
      toast(`Rekord gespeichert: ${ex?.name || 'Übung'} ${fmtWU(w, u)} × ${r}`);
      onDone ? onDone() : render();
    },
    del: () => {
      deletePr(pr.id);
      closeSheet();
      toast('Rekord gelöscht');
      onDone ? onDone() : render();
    },
  });
  est();
  if (!pr) setTimeout(() => document.getElementById('prW')?.focus(), 350);
}

/** Eingetragene Rekorde einer Übung als Liste (für die Detailansicht). */
export function prRows(exId) {
  const u = exUnit(exId);
  return (data.prs || []).filter((p) => p.exId === exId).slice().reverse().map((p) => `<button class="hist-row" data-action="editPr" data-id="${esc(p.id)}" aria-label="Rekord vom ${fmtDateLong(p.date)} ändern">
      <span class="hist-date">${fmtDateLong(p.date)}</span><span class="hist-sets">${fmtWU(p.w, u)} × ${p.r}</span><span class="chev">${ICON.chev}</span></button>`).join('');
}
