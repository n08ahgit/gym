// =============================================================
// setedit.js – Fenster „Satz ändern“ (laufendes und gespeichertes Workout)
//
// openSetEditor({ title, sub, uni, u, set, onSave(newSet), onSkip?, onDelete? })
//   set   = bisheriger Satz { w (kg), r, rl?, rr?, status } oder null (neu)
//   u     = Einheit der Übung ('kg' | 'lb'); gespeichert wird immer kg
// =============================================================

import { openSheet, closeSheet, toast } from '../app.js';
import { esc, fmtNum, fmtWU, fromU, parseNum } from '../util.js';

export function openSetEditor({ title, sub, uni, u, set, onSave, onSkip, onDelete }) {
  const done = set?.status === 'done';
  const repField = (id, label, v) => `<label class="field${uni ? ' side' : ''}"><input id="${id}" inputmode="numeric" pattern="[0-9]*" value="${v != null ? fmtNum(v) : ''}" placeholder="0" autocomplete="off" data-enter="saveEdit"><span>${label}</span></label>`;
  openSheet(`<h2 class="sheet-title">${esc(title)}</h2>
    <p class="muted small sheet-sub">${esc(sub)}</p>
    <div class="inputs edit-inputs${uni ? ' uni' : ''}">
      <label class="field"><input id="edW" inputmode="decimal" value="${done && set.w != null ? fmtWU(set.w, u, false) : ''}" placeholder="0" autocomplete="off" data-enter="saveEdit"><span>${u}</span></label>
      ${uni ? repField('edRL', 'Links', done ? set.rl ?? set.r : null) + repField('edRR', 'Rechts', done ? set.rr ?? set.r : null)
        : repField('edR', 'Wdh', done ? set.r : null)}
    </div>
    <div class="sheet-actions">
      <button class="btn primary big" data-action="saveEdit">Speichern</button>
      ${done && onSkip ? '<button class="btn ghost big" data-action="skipEdit">Als übersprungen markieren</button>' : ''}
      ${onDelete ? '<button class="btn ghost big danger" data-action="delEdit">Satz löschen</button>' : ''}
    </div>`, {
    saveEdit: () => {
      const num = (id) => parseNum(document.getElementById(id)?.value);
      const w = fromU(num('edW'), u);
      let r, sides = null;
      if (uni) {
        const rl = num('edRL'), rr = num('edRR');
        if ([rl, rr].some((x) => Number.isNaN(x) || (x !== null && !Number.isInteger(x)))) return toast('Wiederholungen bitte als ganze Zahlen');
        sides = [rl ?? rr ?? null, rr ?? rl ?? null];
        r = sides[0] == null ? null : Math.min(sides[0], sides[1]);
      } else {
        r = num('edR');
        if (Number.isNaN(r) || (r !== null && !Number.isInteger(r))) return toast('Wiederholungen bitte als ganze Zahl');
      }
      if (Number.isNaN(w)) return toast('Bitte gültige Zahlen eingeben');
      if (w == null && r == null) return toast('Gewicht oder Wiederholungen eintragen');
      closeSheet();
      onSave({ w, r, ...(w != null ? { u } : {}), ...(sides ? { rl: sides[0], rr: sides[1] } : {}), status: 'done' });
      toast('Satz geändert');
    },
    skipEdit: () => { closeSheet(); onSkip(); toast('Als übersprungen markiert'); },
    delEdit: () => { closeSheet(); onDelete(); toast('Satz gelöscht'); },
  });
  setTimeout(() => document.getElementById('edW')?.focus(), 350);
}
