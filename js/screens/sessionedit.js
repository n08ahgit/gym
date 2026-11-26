// =============================================================
// sessionedit.js – gespeichertes Workout nachträglich bearbeiten
//
// Erreichbar aus der Jahresansicht (Tag antippen → „Bearbeiten“), aus dem
// Übungsverlauf (Training antippen) und von der Startseite (heute erledigt).
// Ändern: Sätze (Gewicht/Wdh), Sätze nachtragen/hinzufügen/löschen,
// Datum, Name. Oder das ganze Workout löschen.
// =============================================================

import { go, render, ui, ask, toast } from '../app.js';
import { data, updateSession, deleteSession, exUnit } from '../store.js';
import { esc, fmtSet, fmtDateLong, fmtDurationLong, setVol, fmtVol, parseDate, dateStr, addDays } from '../util.js';
import { ICON } from './icons.js';
import { openSetEditor } from './setedit.js';
import { getExercise } from '../exercises.js';

const find = (id) => data.sessions.find((s) => s.id === id);

function goBack() {
  const b = ui.params.back;
  if (b?.screen && b.screen !== 'session') go(b.screen, b.params || {});
  else go('home');
}

export const sessionScreen = {
  render({ id }) {
    const s = find(id);
    if (!s) return `<header class="topbar"><button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button><span class="topbar-mid">Workout</span><span class="topbar-spacer"></span></header>
      <main class="content"><p class="muted">Dieses Workout gibt es nicht mehr.</p></main>`;
    let sets = 0, vol = 0;
    const cards = s.exercises.map((e, xi) => {
      const u = exUnit(e.exId);
      const chips = e.sets.map((x, i) => (x.status === 'done'
        ? `<button class="set-chip${x.pr ? ' pr' : ''}" data-action="set" data-ex="${xi}" data-set="${i}" aria-label="Satz ${i + 1} ändern">${fmtSet(x, ' × ', u)}</button>`
        : `<button class="set-chip skip" data-action="set" data-ex="${xi}" data-set="${i}" aria-label="Satz ${i + 1} nachtragen">+ Satz ${i + 1}</button>`)).join('');
      e.sets.forEach((x) => { if (x.status === 'done') { sets++; vol += setVol(x); } });
      return `<section class="card se-ex">
        <div class="card-head"><h2>${esc(e.name)}</h2><span class="muted small">${u}${e.uni ? ' · einseitig' : ''}</span></div>
        <div class="sum-sets">${chips}<button class="set-chip add" data-action="addSet" data-ex="${xi}" aria-label="Satz hinzufügen">${ICON.plus}</button></div>
      </section>`;
    }).join('');
    return `<header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">Workout bearbeiten</span><span class="topbar-spacer"></span>
      </header>
      <main class="content session-edit">
        <label class="gfield"><span>Name</span><input id="seName" value="${esc(s.workoutName)}" maxlength="40" autocomplete="off" data-input="name"></label>
        <div class="two">
          <label class="gfield"><span>Datum</span><input id="seDate" type="date" value="${s.date}" max="${dateStr()}" data-input="date"></label>
          <div class="gfield static"><span>Dauer · Volumen</span><b>${fmtDurationLong(s.end - s.start)} · ${fmtVol(vol)}</b></div>
        </div>
        <p class="muted small se-hint">Satz antippen zum Ändern · „+ Satz“ nachtragen · ＋ fügt einen Satz hinzu. Alles wird sofort gespeichert.</p>
        ${cards}
        <button class="btn ghost big danger full" data-action="delete">${ICON.trash} Workout löschen</button>
      </main>`;
  },

  actions: {
    back: () => goBack(),
    set: (el) => {
      const s = find(ui.params.id), xi = +el.dataset.ex, si = +el.dataset.set;
      const e = s.exercises[xi], x = e.sets[si];
      const uni = e.uni ?? !!getExercise(e.exId)?.uni;
      openSetEditor({
        title: e.name, sub: `${fmtDateLong(s.date)} · Satz ${si + 1}`, uni, u: exUnit(e.exId), set: x,
        onSave: (ns) => { updateSession(s.id, (ss) => { ss.exercises[xi].sets[si] = ns; }); render(); },
        onSkip: () => { updateSession(s.id, (ss) => { ss.exercises[xi].sets[si] = { w: null, r: null, status: 'skipped' }; }); render(); },
        onDelete: () => {
          updateSession(s.id, (ss) => {
            const ex = ss.exercises[xi];
            ex.sets.splice(si, 1);
            ex.planned = Math.max(ex.sets.length, Math.min(ex.planned || 0, ex.sets.length));
          });
          render();
        },
      });
    },
    addSet: (el) => {
      const s = find(ui.params.id), xi = +el.dataset.ex;
      const e = s.exercises[xi];
      const prev = [...e.sets].reverse().find((x) => x.status === 'done');
      openSetEditor({
        title: e.name, sub: `Satz ${e.sets.length + 1} hinzufügen`, uni: e.uni ?? !!getExercise(e.exId)?.uni, u: exUnit(e.exId),
        set: prev ? { ...prev } : null,
        onSave: (ns) => { updateSession(s.id, (ss) => { ss.exercises[xi].sets.push(ns); }); render(); },
      });
    },
    delete: async () => {
      const s = find(ui.params.id);
      if (!(await ask('Workout löschen?', `${s.workoutName} vom ${fmtDateLong(s.date)} wird endgültig gelöscht.`, 'Löschen', true))) return;
      deleteSession(s.id);
      toast('Workout gelöscht');
      goBack();
    },
  },

  inputs: {
    name: (el) => { const v = el.value.trim(); if (v) updateSession(ui.params.id, (s) => { s.workoutName = v.slice(0, 40); }); },
    date: (el) => {
      const ds = el.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || ds > dateStr()) return;
      updateSession(ui.params.id, (s) => {
        // Start/Ende um die gleiche Anzahl Tage verschieben (Uhrzeit bleibt)
        const days = Math.round((parseDate(ds) - parseDate(s.date)) / 864e5);
        s.start = addDays(new Date(s.start), days).getTime();
        s.end = addDays(new Date(s.end), days).getTime();
        s.date = ds;
      });
      toast(`Verschoben auf ${fmtDateLong(ds)}`);
    },
  },
};
