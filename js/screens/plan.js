// =============================================================
// plan.js – Workout eines Wochentags bearbeiten, Übung suchen,
//           eigene Übung anlegen
//
// Bearbeitet wird eine Kopie ("draft"). Erst "Speichern" schreibt eine
// neue Plan-Version (store.setPlanDay).
// =============================================================

import { go, render, ask, toast } from '../app.js';
import { currentPlan, setPlanDay, addCustomExercise, dayLabel } from '../store.js';
import { WEEKDAYS, esc, fmtClock, clone, uid } from '../util.js';
import { allExercises, muscleNames, MUSCLES } from '../exercises.js';
import { searchExercises } from '../search.js';
import { ICON } from './icons.js';
import { openExerciseInfo } from './exinfo.js';

const DEFAULT_SETS = 3;
const DEFAULT_REST = 120; // Sekunden
const REST_STEP = 15;

/** Bearbeitungszustand (bleibt erhalten, während man in die Suche wechselt). */
let draft = null; // { idx, workout: {name, exercises}, dirty }

function ensureDraft(idx) {
  if (!draft || draft.idx !== idx) {
    draft = { idx, workout: clone(currentPlan()[idx]) || { name: '', exercises: [] }, dirty: false };
  }
}

// ---------- Editor ----------

export const editScreen = {
  render({ idx }) {
    ensureDraft(idx);
    const w = draft.workout;
    const rows = w.exercises
      .map((e, i) => `
      <li class="ex-row">
        <div class="ex-row-top">
          <span class="ex-row-name"><span class="muted">${i + 1}.</span> ${esc(e.name)}</span>
          <span class="ex-row-move">
            <button class="icon-btn sm" data-action="info" data-i="${i}" aria-label="Ausführung und Tipps">${ICON.info}</button>
            <button class="icon-btn sm" data-action="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">${ICON.up}</button>
            <button class="icon-btn sm" data-action="down" data-i="${i}" ${i === w.exercises.length - 1 ? 'disabled' : ''} aria-label="Nach unten">${ICON.down}</button>
            <button class="icon-btn sm" data-action="remove" data-i="${i}" aria-label="Entfernen">${ICON.x}</button>
          </span>
        </div>
        <div class="ex-row-controls">
          <div class="stepper">
            <button data-action="sets" data-i="${i}" data-d="-1" ${e.sets <= 1 ? 'disabled' : ''} aria-label="Weniger Sätze">${ICON.minus}</button>
            <span class="stepper-mid"><span class="stepper-label">Sätze</span><span class="stepper-val">${e.sets}</span></span>
            <button data-action="sets" data-i="${i}" data-d="1" ${e.sets >= 10 ? 'disabled' : ''} aria-label="Mehr Sätze">${ICON.plus}</button></div>
          <div class="stepper">
            <button data-action="rest" data-i="${i}" data-d="-1" ${e.rest <= 0 ? 'disabled' : ''} aria-label="Kürzere Pause">${ICON.minus}</button>
            <span class="stepper-mid"><span class="stepper-label">Pause</span><span class="stepper-val">${fmtClock(e.rest)}</span></span>
            <button data-action="rest" data-i="${i}" data-d="1" ${e.rest >= 600 ? 'disabled' : ''} aria-label="Längere Pause">${ICON.plus}</button></div>
          <div class="seg-wrap side-toggle" role="group" aria-label="Ausführung">
            <button class="seg-item${e.uni ? '' : ' on'}" data-action="uni" data-i="${i}" data-v="0">Beidseitig</button>
            <button class="seg-item${e.uni ? ' on' : ''}" data-action="uni" data-i="${i}" data-v="1">Einseitig (L/R)</button>
          </div>
        </div>
      </li>`)
      .join('');

    return `
      <header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">${dayLabel(idx)}</span>
        <span class="topbar-spacer"></span>
      </header>
      <main class="content has-footer">
        <label class="label" for="wname">Name des Workouts</label>
        <input id="wname" class="input big-input" data-input="name" value="${esc(w.name)}" placeholder="z. B. Torso" autocomplete="off" maxlength="40">
        <h3 class="section-title">Übungen</h3>
        ${w.exercises.length ? `<ol class="ex-list">${rows}</ol>` : '<p class="muted">Noch keine Übungen.</p>'}
        <button class="btn big dashed" data-action="add">${ICON.plus} Übung hinzufügen</button>
        ${currentPlan()[idx] ? '<button class="btn ghost danger full" data-action="makeRest">Zum Pausetag machen</button>' : ''}
      </main>
      <footer class="bottom"><button class="btn primary big" data-action="save">Speichern</button></footer>`;
  },

  inputs: {
    name: (el) => { draft.workout.name = el.value; draft.dirty = true; },
  },

  actions: {
    back: async () => {
      if (draft.dirty && !(await ask('Änderungen verwerfen?', '', 'Verwerfen', true))) return;
      draft = null;
      go('home');
    },
    add: () => go('search', { idx: draft.idx, q: '' }),
    info: (el) => { const e = draft.workout.exercises[+el.dataset.i]; openExerciseInfo(e.exId, e.name); },
    uni: (el) => {
      const e = draft.workout.exercises[+el.dataset.i];
      if (el.dataset.v === '1') e.uni = true; else delete e.uni;
      draft.dirty = true;
      render();
    },
    up: (el) => move(+el.dataset.i, -1),
    down: (el) => move(+el.dataset.i, 1),
    remove: (el) => { draft.workout.exercises.splice(+el.dataset.i, 1); draft.dirty = true; render(); },
    sets: (el) => {
      const e = draft.workout.exercises[+el.dataset.i];
      e.sets = Math.min(10, Math.max(1, e.sets + Number(el.dataset.d)));
      draft.dirty = true;
      render();
    },
    rest: (el) => {
      const e = draft.workout.exercises[+el.dataset.i];
      e.rest = Math.min(600, Math.max(0, e.rest + Number(el.dataset.d) * REST_STEP));
      draft.dirty = true;
      render();
    },
    save: () => {
      const w = draft.workout;
      w.name = w.name.trim() || 'Workout';
      setPlanDay(draft.idx, w);
      draft = null;
      toast('Gespeichert');
      go('home');
    },
    makeRest: async () => {
      if (!(await ask(`${dayLabel(draft.idx)} zum Pausetag machen?`, 'Das Workout dieses Tages wird aus dem Plan entfernt. Vergangene Tage bleiben unverändert.', 'Pausetag', true))) return;
      setPlanDay(draft.idx, null);
      draft = null;
      go('home');
    },
  },
};

function move(i, d) {
  const list = draft.workout.exercises;
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  draft.dirty = true;
  render();
}

// ---------- Übungssuche ----------

function resultsHtml(q) {
  const res = searchExercises(q, allExercises());
  const custom = `<button class="result create" data-action="custom">${ICON.plus}<span>Eigene Übung anlegen${q.trim() ? `: „${esc(q.trim())}“` : ''}</span></button>`;
  if (!res.length) return `<p class="muted center-text">Nichts gefunden.</p>${custom}`;
  return res
    .slice(0, 60)
    .map((e) => `<button class="result" data-action="pick" data-id="${esc(e.id)}">
        <span class="result-name">${esc(e.name)}${e.custom ? ' <span class="tag">eigene</span>' : ''}${e.uni ? ' <span class="uni-tag">einseitig</span>' : ''}</span>
        <span class="result-sub">${esc(muscleNames(e.primary))}</span></button>`)
    .join('') + custom;
}

export const searchScreen = {
  render({ q }) {
    return `
      <header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">Übung hinzufügen</span>
        <span class="topbar-spacer"></span>
      </header>
      <div class="search-bar">${ICON.search}
        <input id="q" class="input" type="search" data-input="q" value="${esc(q)}" placeholder="Suchen, z. B. Bankdrücken" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
      <main class="content results" id="results">${resultsHtml(q)}</main>`;
  },
  after(root) {
    root.querySelector('#q').focus();
  },
  inputs: {
    q: (el) => {
      document.getElementById('results').innerHTML = resultsHtml(el.value);
      document.getElementById('results').scrollTop = 0;
    },
  },
  actions: {
    back: () => go('edit', { idx: draft.idx }),
    pick: (el) => {
      const ex = allExercises().find((e) => e.id === el.dataset.id);
      addToDraft(ex);
    },
    custom: () => go('custom', { idx: draft.idx, name: document.getElementById('q').value.trim() }),
  },
};

function addToDraft(ex) {
  draft.workout.exercises.push({ exId: ex.id, name: ex.name, sets: DEFAULT_SETS, rest: DEFAULT_REST, ...(ex.uni ? { uni: true } : {}) });
  draft.dirty = true;
  toast(`${ex.name} hinzugefügt`);
  go('edit', { idx: draft.idx });
}

// ---------- Eigene Übung ----------

let customForm = null; // { name, primary:Set, secondary:Set }

export const customScreen = {
  render({ name }) {
    if (!customForm) customForm = { name: name || '', primary: new Set(), secondary: new Set() };
    const chips = (kind) =>
      Object.entries(MUSCLES)
        .map(([k, label]) => `<button class="chip${customForm[kind].has(k) ? ' on' : ''}${kind === 'secondary' ? ' sec' : ''}" data-action="toggle" data-kind="${kind}" data-k="${k}">${label}</button>`)
        .join('');
    return `
      <header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">Eigene Übung</span>
        <span class="topbar-spacer"></span>
      </header>
      <main class="content has-footer">
        <label class="label" for="cname">Name</label>
        <input id="cname" class="input big-input" data-input="cname" value="${esc(customForm.name)}" placeholder="z. B. Kabelrudern einarmig" maxlength="40" autocomplete="off">
        <h3 class="section-title">Hauptmuskeln</h3>
        <div class="chips">${chips('primary')}</div>
        <h3 class="section-title">Nebenmuskeln <span class="muted">(optional)</span></h3>
        <div class="chips">${chips('secondary')}</div>
      </main>
      <footer class="bottom"><button class="btn primary big" data-action="saveCustom">Übung anlegen</button></footer>`;
  },
  inputs: {
    cname: (el) => { customForm.name = el.value; },
  },
  actions: {
    back: () => { customForm = null; go('search', { idx: draft.idx, q: '' }); },
    toggle: (el) => {
      const { kind, k } = el.dataset;
      const other = kind === 'primary' ? 'secondary' : 'primary';
      if (customForm[kind].has(k)) customForm[kind].delete(k);
      else { customForm[kind].add(k); customForm[other].delete(k); }
      render();
    },
    saveCustom: () => {
      const name = customForm.name.trim();
      if (!name) return toast('Bitte einen Namen eingeben');
      if (!customForm.primary.size) return toast('Bitte mindestens einen Hauptmuskel wählen');
      const ex = { id: 'c_' + uid(), name, primary: [...customForm.primary], secondary: [...customForm.secondary] };
      addCustomExercise(ex);
      customForm = null;
      addToDraft(ex);
    },
  },
};
