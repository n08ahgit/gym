// =============================================================
// workout.js – Workout-Modus
//
// Laufendes Workout ("active", gespeichert in localStorage bei JEDER
// Änderung, damit es das Schließen der App überlebt):
// {
//   id, startedAt: ms, endedAt: ms|null, dayIdx, workoutName,
//   items: [ { exId, name, primary[], secondary[], sets, rest,
//              results: [ { w, r, status: "done"|"skipped" } ] } ],
//   cur: { ex, set },        // Zeiger auf den NÄCHSTEN Satz
//   phase: "exercise" | "restPick" | "rest" | "summary",
//   rest: { end: ms, total: s } | null,   // Pause über End-Zeitstempel
//   restDefault: s           // Vorschlag für die Pausenauswahl
// }
// =============================================================

import { go, render, transition, ui, openSheet, closeSheet, ask, toast, syncWakeLock } from '../app.js';
import { loadActive, saveActive, lastDoneSets, addSession } from '../store.js';
import { getExercise, muscleNames } from '../exercises.js';
import { bodyImage } from '../bodyimage.js';
import { beep } from '../audio.js';
import { esc, fmtClock, fmtElapsed, fmtDurationLong, fmtNum, fmtBig, parseNum, parseRestInput, dateStr, fmtDateLong, uid } from '../util.js';
import { ICON } from './icons.js';
import { computeStreak, celebrationFor } from '../streak.js';
import { showCelebration } from '../celebrate.js';
import { suggest, hasPlates, checkRecord } from '../coach.js';
import { showRecord } from '../record.js';
import { autoBackup } from '../backup.js';
import { openExerciseInfo, openPlates } from './exinfo.js';
import { scheduleRestPush, cancelRestPush } from '../push.js';

let active = loadActive();

// Ein beim Schließen noch nicht beendetes Workout auf gültigen Zustand prüfen
if (active && (!Array.isArray(active.items) || !active.cur)) active = null;

export const getActive = () => active;
export const hasActive = () => !!active;

function persist() {
  saveActive(active);
}

export function discardActive() {
  active = null;
  persist();
  syncWakeLock();
}

/** Neues Workout aus einem Plan-Tag starten. */
export function startWorkout(dayIdx, workout) {
  active = {
    id: uid(),
    startedAt: Date.now(),
    endedAt: null,
    dayIdx,
    workoutName: workout.name,
    items: workout.exercises.map((e) => {
      const ex = getExercise(e.exId);
      return {
        exId: e.exId,
        name: ex?.name || e.name,
        primary: ex?.primary || [],
        secondary: ex?.secondary || [],
        sets: e.sets,
        rest: e.rest,
        results: [],
      };
    }),
    cur: { ex: 0, set: 0 },
    phase: 'exercise',
    rest: null,
    restDefault: 0,
  };
  persist();
}

// ---------- Ablauf-Logik ----------

const curItem = () => active.items[active.cur.ex];
const isFinished = () => active.cur.ex >= active.items.length;

/** Zeiger auf nächsten Satz/nächste Übung setzen. */
function advance() {
  const it = curItem();
  active.cur.set++;
  if (active.cur.set >= it.sets) {
    active.cur.ex++;
    active.cur.set = 0;
  }
}

function toSummary() {
  active.phase = 'summary';
  active.rest = null;
  active.endedAt = Date.now();
}

/** Satz erledigt (Werte schon geprüft). Rückgabe: Rekord oder null. */
function completeSet(w, r) {
  const it = curItem();
  const rec = checkRecord(it.exId, w, r, it.results);
  it.results[active.cur.set] = { w, r, status: 'done', ...(rec ? { pr: 1 } : {}) };
  const restDefault = it.rest;
  advance();
  if (isFinished()) toSummary();
  else if (restDefault > 0) {
    active.phase = 'restPick';
    active.restDefault = restDefault;
  } else active.phase = 'exercise';
  persist();
  return rec ? { ...rec, name: it.name, w, r } : null;
}

function skipSet() {
  curItem().results[active.cur.set] = { w: null, r: null, status: 'skipped' };
  advance();
  if (isFinished()) toSummary();
  persist();
}

function skipExercise() {
  const it = curItem();
  for (let s = active.cur.set; s < it.sets; s++) it.results[s] = { w: null, r: null, status: 'skipped' };
  active.cur.ex++;
  active.cur.set = 0;
  if (isFinished()) toSummary();
  persist();
}

function startRest(sec) {
  active.phase = 'rest';
  active.rest = { end: Date.now() + sec * 1000, total: sec };
  persist();
}

function endRest() {
  active.phase = 'exercise';
  active.rest = null;
  persist();
}

/** Werte für "Letztes Mal" eines bestimmten Satzes. */
function lastFor(exId, setIdx) {
  const last = lastDoneSets(exId);
  if (!last) return null;
  return last[setIdx] || last[last.length - 1];
}

/** Statistik für Zusammenfassung / Speichern. */
function stats(a) {
  let sets = 0, volume = 0;
  for (const it of a.items) {
    for (const r of it.results) {
      if (r?.status !== 'done') continue;
      sets++;
      if (r.w != null && r.r != null) volume += r.w * r.r;
    }
  }
  return { sets, volume, duration: (a.endedAt || Date.now()) - a.startedAt };
}

// ---------- Mitteilung am Pausenende (App im Hintergrund) ----------
// Geht die App während einer Pause in den Hintergrund, bestellt sie beim
// Push-Server eine Mitteilung 10 s vor der Endzeit; kommt sie zurück, wird sie
// abbestellt (dann piept die App selbst).
const PUSH_LEAD = 10000;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // 10 s vor Pausenende, damit noch Zeit zum Zurückgehen bleibt
    const at = active?.phase === 'rest' ? active.rest.end - PUSH_LEAD : 0;
    if (at - Date.now() > 3000) {
      const it = active.items[active.cur.ex];
      scheduleRestPush(at, 'Noch 10 Sekunden Pause', it ? `Gleich: ${it.name} · Satz ${active.cur.set + 1} von ${it.sets}` : 'Gleich geht\'s weiter');
    }
  } else cancelRestPush();
});

// ---------- Takt (von app.js alle 250 ms aufgerufen) ----------

export function workoutTick() {
  // Anderer Tab hat das Workout beendet/gespeichert? (z. B. zweites Fenster)
  if (!active) return;
  const now = Date.now();

  if (active.phase === 'rest') {
    const left = (active.rest.end - now) / 1000;
    if (left <= 0) {
      // Nur piepen, wenn die Pause gerade eben abgelaufen ist (nicht nach
      // dem Wiederöffnen der App Minuten später).
      if (left > -5) beep();
      endRest();
      // Weicher Wechsel zurück zur Übung statt hartem Sprung
      if (ui.screen === 'workout' || ui.screen === 'home') transition(render);
      return;
    }
    document.querySelectorAll('[data-bind="countdown"]').forEach((el) => (el.textContent = fmtClock(left)));
    const ring = document.querySelector('[data-bind="ring"]');
    if (ring) ring.style.strokeDashoffset = String(RING_LEN * (1 - left / active.rest.total));
  }

  const elapsed = fmtElapsed((active.endedAt || now) - active.startedAt);
  document.querySelectorAll('[data-bind="elapsed"]').forEach((el) => (el.textContent = elapsed));
}

const RING_R = 120;
const RING_LEN = 2 * Math.PI * RING_R;

// ---------- Ansichten ----------

function topbar(mid) {
  return `<header class="topbar">
    <button class="glass-circle" data-action="home" aria-label="Zur Übersicht">${ICON.back}</button>
    <span class="topbar-mid">${mid}</span>
    <span class="glass-pill"><button data-action="menu">Beenden</button></span></header>`;
}

function progressBar() {
  const total = active.items.reduce((n, it) => n + it.sets, 0);
  const doneCount = active.items.reduce((n, it) => n + it.results.filter(Boolean).length, 0);
  return `<div class="progress"><div style="width:${total ? (doneCount / total) * 100 : 0}%"></div></div>`;
}

function nextUpHtml() {
  const it = curItem();
  return `<p class="next-up">Als Nächstes: <b>${esc(it.name)}</b> · Satz ${active.cur.set + 1} von ${it.sets}</p>`;
}

function viewExercise() {
  const it = curItem();
  const s = active.cur.set;
  const last = lastFor(it.exId, s);
  // Platzhalter: letztes Mal, sonst der vorige Satz von heute
  const prevToday = it.results.slice(0, s).reverse().find((r) => r?.status === 'done');
  const ph = last || prevToday || null;
  const dots = Array.from({ length: it.sets }, (_, i) => {
    const r = it.results[i];
    const cls = r?.status === 'done' ? 'done' : r?.status === 'skipped' ? 'skip' : i === s ? 'now' : '';
    return `<i class="${cls}"></i>`;
  }).join('');
  const todaySets = it.results
    .filter((r) => r?.status === 'done')
    .map((r) => `${fmtNum(r.w)} × ${fmtNum(r.r)}`)
    .join(' · ');

  return `${topbar(`Übung ${active.cur.ex + 1} von ${active.items.length}`)}
    ${progressBar()}
    <main class="content workout has-footer-lg">
      <div class="ex-head">
        <h2 class="ex-name">${esc(it.name)}</h2>
        <button class="glass-circle sm" data-action="info" aria-label="Ausführung und Tipps">${ICON.info}</button>
      </div>
      <p class="ex-muscles">${esc(muscleNames(it.primary))}</p>
      ${bodyImage(it.primary, it.secondary)}
      <div class="set-head"><span class="set-label">Satz ${s + 1} von ${it.sets}</span><span class="dots">${dots}</span></div>
      <p class="last">Letztes Mal: ${last ? `<b>${fmtNum(last.w)} kg × ${fmtNum(last.r)}</b>` : '<b>–</b> (noch keine Werte)'}</p>
      <div class="inputs">
        <label class="field"><input id="inW" inputmode="decimal" placeholder="${ph?.w != null ? fmtNum(ph.w) : '0'}" autocomplete="off" enterkeyhint="next" data-enter="focusReps"><span>kg</span></label>
        <label class="field"><input id="inR" inputmode="numeric" pattern="[0-9]*" placeholder="${ph?.r != null ? fmtNum(ph.r) : '0'}" autocomplete="off" enterkeyhint="done" data-enter="setDone"><span>Wdh</span></label>
      </div>
      ${coachBox(it)}
      ${todaySets ? `<p class="today-sets">Heute: ${todaySets}</p>` : ''}
    </main>
    <footer class="bottom">
      <button class="btn primary big" data-action="setDone">Satz fertig</button>
      <div class="row">
        <button class="btn ghost" data-action="skipSet">Satz überspringen</button>
        <button class="btn ghost" data-action="skipEx">Übung überspringen</button>
      </div>
    </footer>`;
}

/** Vorschlag für heute (doppelte Progression) + Scheibenrechner. */
function coachBox(it) {
  const sug = suggest(it.exId);
  const canUse = sug.w != null || sug.target != null;
  return `<div class="coach">
    <div class="coach-main">
      <span class="coach-label">Vorschlag heute</span>
      <b class="coach-head">${esc(sug.head)}</b>
      <span class="coach-why">${esc(sug.why)}</span>
    </div>
    <div class="coach-actions">
      ${canUse && sug.kind !== 'time' ? '<button class="chip" data-action="useSug">Übernehmen</button>' : ''}
      ${hasPlates(it.exId) ? `<button class="chip" data-action="plates">${ICON.plates} Scheiben</button>` : ''}
    </div>
  </div>`;
}

function viewRestPick() {
  return `${topbar('Pause')}
    ${progressBar()}
    <main class="content center-col">
      <p class="muted">${ICON.check} Satz gespeichert</p>
      <button class="btn primary huge" data-action="startRest" data-sec="${active.restDefault}">
        <span class="huge-time">${fmtClock(active.restDefault)}</span><span class="huge-sub">Pause starten</span></button>
      <div class="custom-rest">
        <input id="customRest" class="input" inputmode="decimal" placeholder="Eigene Zeit (Min)" autocomplete="off" data-enter="startCustomRest">
        <button class="btn" data-action="startCustomRest">Start</button>
      </div>
      <button class="text-btn muted" data-action="noRest">Ohne Pause weiter</button>
      ${nextUpHtml()}
    </main>`;
}

function viewRest() {
  const left = (active.rest.end - Date.now()) / 1000;
  return `${topbar('Pause')}
    ${progressBar()}
    <main class="content center-col">
      <div class="ring">
        <svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="${RING_R}" class="ring-bg"/>
          <circle cx="130" cy="130" r="${RING_R}" class="ring-fg" data-bind="ring"
            style="stroke-dasharray:${RING_LEN};stroke-dashoffset:${RING_LEN * (1 - left / active.rest.total)}"/></svg>
        <span class="countdown" role="timer" aria-label="Restliche Pause" data-bind="countdown">${fmtClock(left)}</span>
      </div>
      <div class="row wide">
        <button class="btn big nocaps" data-action="plus30">+30 s</button>
        <button class="btn primary big" data-action="endRest">Pause beenden</button>
      </div>
      ${nextUpHtml()}
    </main>`;
}

function viewSummary() {
  const st = stats(active);
  const finished = isFinished();
  const rows = active.items.map((it) => {
    const done = it.results.filter((r) => r?.status === 'done');
    const label = done.length === 0 ? '<span class="badge skip">übersprungen</span>'
      : done.length < it.sets ? `<span class="badge part">${done.length}/${it.sets}</span>`
      : '<span class="badge ok">gemacht</span>';
    const sets = done.map((r) => `${fmtNum(r.w)} × ${fmtNum(r.r)}`).join(' · ');
    const pr = done.some((r) => r.pr) ? `<span class="badge pr">${ICON.award} Rekord</span>` : '';
    return `<li><div class="sum-top"><span>${esc(it.name)}</span><span class="badges">${pr}${label}</span></div>${sets ? `<div class="sum-sets">${sets}</div>` : ''}</li>`;
  }).join('');

  return `<header class="topbar"><span class="topbar-spacer"></span><span class="topbar-mid">Zusammenfassung</span><span class="topbar-spacer"></span></header>
    <main class="content has-footer-lg">
      <h2 class="sum-title">${esc(active.workoutName)}</h2>
      <p class="muted">${fmtDateLong(dateStr(new Date(active.startedAt)))}</p>
      <div class="stats">
        <div><b>${fmtDurationLong(st.duration)}</b><span>Dauer</span></div>
        <div><b>${st.sets}</b><span>Sätze</span></div>
        <div><b>${fmtBig(st.volume)}</b><span>kg Volumen</span></div>
      </div>
      <ul class="sum-list">${rows}</ul>
      ${st.sets === 0 ? '<p class="hint">Keine Sätze erledigt – es gibt nichts zu speichern.</p>' : ''}
    </main>
    <footer class="bottom">
      ${st.sets > 0 ? '<button class="btn primary big" data-action="save">Speichern</button>' : '<button class="btn primary big" data-action="discard">Verwerfen</button>'}
      <div class="row">
        ${finished ? '' : '<button class="btn ghost" data-action="continue">Weiter trainieren</button>'}
        ${st.sets > 0 ? '<button class="btn ghost danger" data-action="abort">Abbrechen</button>' : ''}
      </div>
    </footer>`;
}

// ---------- Screen ----------

export const workoutScreen = {
  render() {
    if (!active) return '<main class="content"><p class="muted">Kein Workout aktiv.</p><button class="btn big" data-action="home">Zur Übersicht</button></main>';
    // Pause abgelaufen, während die App zu war? -> direkt Übung zeigen
    if (active.phase === 'rest' && active.rest.end <= Date.now()) endRest();
    if (active.phase !== 'summary' && isFinished()) toSummary();
    switch (active.phase) {
      case 'restPick': return viewRestPick();
      case 'rest': return viewRest();
      case 'summary': return viewSummary();
      default: return viewExercise();
    }
  },

  actions: {
    home: () => go('home'),

    focusReps: () => document.getElementById('inR')?.focus(),

    setDone: () => {
      const inW = document.getElementById('inW');
      const inR = document.getElementById('inR');
      // Leeres Feld = Platzhalter übernehmen (z. B. gleiche Werte wie letztes Mal)
      const read = (el) => {
        const v = parseNum(el.value);
        if (v !== null) return v;
        const p = parseNum(el.placeholder);
        return p ? p : null;
      };
      const w = read(inW);
      const r = read(inR);
      if (Number.isNaN(w) || Number.isNaN(r)) return toast('Bitte gültige Zahlen eingeben');
      if (r !== null && !Number.isInteger(r)) return toast('Wiederholungen bitte als ganze Zahl');
      document.activeElement?.blur();
      const rec = completeSet(w, r);
      transition(render);
      window.scrollTo(0, 0);
      if (rec) setTimeout(() => showRecord(rec), 350);
    },

    info: () => { const it = curItem(); openExerciseInfo(it.exId, it.name); },

    useSug: () => {
      const sug = suggest(curItem().exId);
      const inW = document.getElementById('inW'), inR = document.getElementById('inR');
      if (sug.w != null) inW.value = fmtNum(sug.w);
      if (sug.target != null) inR.value = sug.target;
      toast('Vorschlag übernommen');
    },

    plates: () => {
      const v = parseNum(document.getElementById('inW')?.value);
      const ph = parseNum(document.getElementById('inW')?.placeholder);
      openPlates(v || suggest(curItem().exId).w || ph || 60);
    },

    skipSet: () => { skipSet(); transition(render); },

    skipEx: async () => {
      if (!(await ask('Übung überspringen?', `${curItem().name} – alle restlichen Sätze werden übersprungen.`, 'Überspringen'))) return;
      skipExercise();
      transition(render);
    },

    startRest: (el) => { startRest(Number(el.dataset.sec)); transition(render); },

    startCustomRest: () => {
      const sec = parseRestInput(document.getElementById('customRest').value);
      if (!sec) return toast('Zeit in Minuten eingeben, z. B. 5 oder 1,5');
      document.activeElement?.blur();
      startRest(sec);
      transition(render);
    },

    noRest: () => { endRest(); transition(render); },

    plus30: () => {
      active.rest.end += 30000;
      active.rest.total += 30;
      persist();
      workoutTick();
    },

    endRest: () => { endRest(); transition(render); },

    menu: () => {
      openSheet(
        `<h2 class="sheet-title">Workout beenden?</h2>
         <div class="sheet-actions">
           <button class="btn primary big" data-action="finish">Beenden &amp; Zusammenfassung</button>
           <button class="btn big danger" data-action="abort">Workout abbrechen</button>
           <button class="btn ghost big" data-action="closeSheet">Weiter trainieren</button>
         </div>`,
        {
          finish: () => { closeSheet(); toSummary(); persist(); render(); },
          abort: () => { closeSheet(); workoutScreen.actions.abort(); },
        }
      );
    },

    continue: () => {
      active.phase = 'exercise';
      active.endedAt = null;
      persist();
      render();
    },

    abort: async () => {
      if (!(await ask('Workout abbrechen?', 'Alle Sätze dieses Workouts werden verworfen.', 'Abbrechen', true))) return;
      discardActive();
      go('home');
    },

    discard: () => { discardActive(); go('home'); },

    save: () => {
      const a = active;
      const before = computeStreak();
      addSession({
        id: a.id,
        date: dateStr(new Date(a.startedAt)),
        start: a.startedAt,
        end: a.endedAt || Date.now(),
        dayIdx: a.dayIdx,
        workoutName: a.workoutName,
        exercises: a.items.map((it) => ({
          exId: it.exId,
          name: it.name,
          planned: it.sets,
          // Nicht erreichte Sätze als übersprungen speichern
          sets: Array.from({ length: it.sets }, (_, i) => it.results[i] || { w: null, r: null, status: 'skipped' }),
        })),
      });
      discardActive();
      autoBackup();
      const party = celebrationFor(before, computeStreak());
      go('home');
      if (party) setTimeout(() => showCelebration(party), 420);
      else toast('Workout gespeichert');
    },
  },
};
