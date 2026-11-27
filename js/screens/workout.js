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
//   restDefault: s,          // Vorschlag für die Pausenauswahl
//   prefill: { ex, set, w, r, rl, rr } | null  // Werte nach "Satz zurück"
// }
// =============================================================

import { go, render, transition, ui, openSheet, closeSheet, ask, toast, syncWakeLock } from '../app.js';
import { loadActive, saveActive, lastDoneSets, addSession, exUnit, setExUnit } from '../store.js';
import { getExercise, muscleNames } from '../exercises.js';
import { bodyImage } from '../bodyimage.js';
import { beep } from '../audio.js';
import { esc, fmtClock, fmtElapsed, fmtDurationLong, fmtNum, fmtBig, parseNum, parseRestInput, dateStr, fmtDateLong, uid, setVol, fmtSet, fmtWU, fromU, fmtVol } from '../util.js';
import { ICON } from './icons.js';
import { computeStreak, celebrationFor } from '../streak.js';
import { showCelebration } from '../celebrate.js';
import { suggest, hasPlates, checkRecord, perDumbbell, dumbbells } from '../coach.js';
import { showRecord } from '../record.js';
import { autoBackup } from '../backup.js';
import { openExerciseInfo, openPlates } from './exinfo.js';
import { scheduleRestPush, cancelRestPush } from '../push.js';
import { openSetEditor } from './setedit.js';
import { parseMinutes } from './sessionedit.js';
import { openExercisePicker } from './expick.js';

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
  import('../friends.js').then((f) => f.publishMe(true)).catch(() => {}); // „trainiert gerade“ beenden
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
        uni: e.uni ?? !!ex?.uni, // einseitig: links und rechts getrennt
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
  import('../friends.js').then((f) => f.publishMe(true)).catch(() => {}); // „trainiert gerade“ für Freunde
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
function completeSet(w, r, sides = null, u = null) {
  const it = curItem();
  active.prefill = null;
  // Einseitig: r = schwächere Seite (zählt für Rekord/Steigerung), rl/rr = beide Seiten
  const rec = checkRecord(it.exId, w, r, it.results);
  it.results[active.cur.set] = { w, r, ...(u && w != null ? { u } : {}), ...(sides ? { rl: sides[0], rr: sides[1] } : {}), status: 'done', ...(rec ? { pr: 1 } : {}) };
  const restDefault = it.rest;
  advance();
  if (isFinished()) toSummary();
  else if (restDefault > 0) {
    active.phase = 'restPick';
    active.restDefault = restDefault;
  } else active.phase = 'exercise';
  persist();
  return rec ? { ...rec, name: it.name, w, r, u } : null;
}

function skipSet() {
  active.prefill = null;
  curItem().results[active.cur.set] = { w: null, r: null, status: 'skipped' };
  advance();
  if (isFinished()) toSummary();
  persist();
}

function skipExercise() {
  active.prefill = null;
  const it = curItem();
  for (let s = active.cur.set; s < it.sets; s++) it.results[s] = { w: null, r: null, status: 'skipped' };
  active.cur.ex++;
  active.cur.set = 0;
  if (isFinished()) toSummary();
  persist();
}

// ---------- Korrigieren ----------

/** Position des zuletzt eingetragenen Satzes vor dem Zeiger (oder null). */
function prevPos() {
  let { ex, set } = active.cur;
  if (ex >= active.items.length) { ex = active.items.length - 1; set = active.items[ex].sets; }
  while (ex >= 0) {
    if (set > 0) return { ex, set: set - 1 };
    ex--;
    if (ex >= 0) set = active.items[ex].sets;
  }
  return null;
}

/** Einen Satz zurück: Zeiger auf den letzten Satz, alte Werte stehen im Feld. */
function backOneSet() {
  const pos = prevPos();
  if (!pos) return false;
  const it = active.items[pos.ex];
  const old = it.results[pos.set];
  it.results.length = pos.set; // dieser und spätere Einträge (gibt es nicht) weg
  active.cur = { ...pos };
  active.prefill = old?.status === 'done' ? { ...pos, w: old.w, r: old.r, rl: old.rl, rr: old.rr } : null;
  active.phase = 'exercise';
  active.rest = null;
  active.endedAt = null;
  cancelRestPush();
  persist();
  return true;
}

/** Wert eines Satzes ändern (Fenster). Funktioniert für alle schon eingetragenen Sätze. */
function openEditSet(exIdx, setIdx) {
  const it = active.items[exIdx];
  const old = it?.results[setIdx];
  if (!old) return;
  openSetEditor({
    title: it.name,
    sub: `Satz ${setIdx + 1} ${old.status === 'done' ? 'ändern' : '(übersprungen) nachtragen'}${perDumbbell(it.exId) ? ' · Gewicht pro Hantel' : ''}`,
    uni: it.uni, u: exUnit(it.exId), set: old,
    onSave: (ns) => {
      const rec = checkRecord(it.exId, ns.w, ns.r, it.results.filter((_, i) => i !== setIdx));
      it.results[setIdx] = { ...ns, ...(rec ? { pr: 1 } : {}) };
      persist();
      render();
    },
    onSkip: () => { it.results[setIdx] = { w: null, r: null, status: 'skipped' }; persist(); render(); },
  });
}

/** Antippbare Satz-Chips (zum Ändern). */
function setChips(exIdx, u = null) {
  const it = active.items[exIdx];
  return it.results.map((r, i) => (r?.status === 'done'
    ? `<button class="set-chip${r.pr ? ' pr' : ''}" data-action="editSet" data-ex="${exIdx}" data-set="${i}" aria-label="Satz ${i + 1} ändern">${fmtSet(r, ' × ', u)}</button>`
    : '')).filter(Boolean).join('');
}

function startRest(sec) {
  active.phase = 'rest';
  active.rest = { end: Date.now() + sec * 1000, total: sec };
  persist();
  armRestPush();
}

function endRest() {
  active.phase = 'exercise';
  active.rest = null;
  persist();
  disarmRestPush();
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
      volume += setVol(r, dumbbells(it.exId));
    }
  }
  return { sets, volume, duration: (a.endedAt || Date.now()) - a.startedAt };
}

// ---------- Mitteilung am Pausenende (App im Hintergrund) ----------
// Zuverlässig auch, wenn iOS die App beim Verlassen sofort einfriert:
//  - Die Mitteilung (10 s vor Pausenende) wird schon beim START der Pause beim
//    Server bestellt – nicht erst beim Verlassen (da kam die Anfrage manchmal nicht mehr raus).
//  - Bleibt die App offen, wird sie kurz vorher wieder abbestellt (dann piept die App selbst).
//  - Beim Verlassen wird zur Sicherheit nochmal bestellt, beim Zurückkommen abbestellt.
const PUSH_LEAD = 10000;
let restGuard = null;
function armRestPush() {
  clearTimeout(restGuard);
  const at = active?.phase === 'rest' ? active.rest.end - PUSH_LEAD : 0;
  if (at - Date.now() <= 1500) return;
  const it = active.items[active.cur.ex];
  scheduleRestPush(at, 'Noch 10 Sekunden Pause', it ? `Gleich: ${it.name} · Satz ${active.cur.set + 1} von ${it.sets}` : 'Gleich geht\'s weiter');
  // App bleibt offen → 2,5 s vor der Mitteilung abbestellen. Ist die App versteckt, läuft dieser Timer nicht (iOS friert ein).
  if (document.visibilityState === 'visible') {
    restGuard = setTimeout(() => { if (document.visibilityState === 'visible') cancelRestPush(); }, Math.max(0, at - Date.now() - 2500));
  }
}
function disarmRestPush() {
  clearTimeout(restGuard);
  cancelRestPush();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') armRestPush();
  else {
    clearTimeout(restGuard);
    // Noch lange Pause? → Bestellung bleibt (wird nur überschrieben) und kurz vorher abbestellt.
    // Sonst gleich abbestellen. (Nie „abbestellen + neu bestellen“ direkt hintereinander – die Anfragen könnten sich überholen.)
    if (active?.phase === 'rest' && active.rest.end - PUSH_LEAD - Date.now() > 15000) armRestPush();
    else cancelRestPush();
  }
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
  return `<p class="next-up">Als Nächstes: <b>${esc(it.name)}</b> · Satz ${active.cur.set + 1} von ${it.sets}</p>
    <button class="chip order-chip" data-action="order">${ICON.edit} Training bearbeiten</button>`;
}

function viewExercise() {
  const it = curItem();
  const s = active.cur.set;
  const u = exUnit(it.exId);
  const last = lastFor(it.exId, s);
  // Platzhalter: letztes Mal, sonst der vorige Satz von heute
  const prevToday = it.results.slice(0, s).reverse().find((r) => r?.status === 'done');
  const ph = last || prevToday || null;
  const dots = Array.from({ length: it.sets }, (_, i) => {
    const r = it.results[i];
    const cls = r?.status === 'done' ? 'done' : r?.status === 'skipped' ? 'skip' : i === s ? 'now' : '';
    return `<i class="${cls}"></i>`;
  }).join('');
  const todaySets = setChips(active.cur.ex, u);
  const pf = active.prefill && active.prefill.ex === active.cur.ex && active.prefill.set === s ? active.prefill : null;
  const val = (v, f = fmtNum) => (pf && v != null ? ` value="${f(v)}"` : '');

  return `${topbar(`Übung ${active.cur.ex + 1} von ${active.items.length}`)}
    ${progressBar()}
    <main class="content workout has-footer-lg">
      <div class="ex-head">
        <h2 class="ex-name">${esc(it.name)}</h2>
        <button class="glass-circle sm" data-action="info" aria-label="Ausführung und Tipps">${ICON.info}</button>
      </div>
      <p class="ex-muscles">${esc(muscleNames(it.primary))} · <button class="text-btn order-link" data-action="order">${ICON.edit} Bearbeiten</button></p>
      ${bodyImage(it.primary, it.secondary)}
      <div class="set-head">${prevPos() ? `<button class="text-btn back-set" data-action="prevSet" aria-label="Einen Satz zurück">${ICON.back}<span>Zurück</span></button>` : ''}<span class="set-label">Satz ${s + 1} von ${it.sets}</span><span class="dots">${dots}</span></div>
      <p class="last">${it.uni ? '<span class="uni-tag">einseitig</span> ' : ''}Letztes Mal: ${last ? `<b>${fmtSet(last, ' × ', u).replace(' × ', ` ${u}${perDumbbell(it.exId) ? ' pro Hantel' : ''} × `)}</b>` : '<b>–</b> (noch keine Werte)'}</p>
      <div class="inputs${it.uni ? ' uni' : ''}">
        <label class="field"><input id="inW" inputmode="decimal" placeholder="${ph?.w != null ? fmtWU(ph.w, u, false) : '0'}"${val(pf?.w, (x) => fmtWU(x, u, false))} autocomplete="off" enterkeyhint="next" data-enter="focusReps"><button class="unit-toggle" data-action="unitToggle" aria-label="Einheit für diese Übung: ${u} – antippen zum Wechseln">${u}</button></label>
        ${it.uni
          ? `<label class="field side"><input id="inRL" inputmode="numeric" pattern="[0-9]*" placeholder="${ph ? fmtNum(ph.rl ?? ph.r ?? 0) : '0'}"${val(pf?.rl ?? pf?.r)} autocomplete="off" enterkeyhint="next" data-enter="focusRight"><span>Links</span></label>
             <label class="field side"><input id="inRR" inputmode="numeric" pattern="[0-9]*" placeholder="${ph ? fmtNum(ph.rr ?? ph.r ?? 0) : '0'}"${val(pf?.rr ?? pf?.r)} autocomplete="off" enterkeyhint="done" data-enter="setDone"><span>Rechts</span></label>`
          : `<label class="field"><input id="inR" inputmode="numeric" pattern="[0-9]*" placeholder="${ph?.r != null ? fmtNum(ph.r) : '0'}"${val(pf?.r)} autocomplete="off" enterkeyhint="done" data-enter="setDone"><span>Wdh</span></label>`}
      </div>
      ${perDumbbell(it.exId) ? `<p class="weight-note">${ICON.info}<span>Gewicht <b>einer</b> Kurzhantel eintragen – nicht beide zusammen.</span></p>` : ''}
      ${coachBox(it)}
      ${todaySets ? `<p class="today-sets"><span>Heute:</span> ${todaySets}</p>` : ''}
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
  const plates = hasPlates(it.exId) ? `<button class="chip" data-action="plates">${ICON.plates} Scheiben</button>` : '';
  // Nur zeigen, wenn mehr Gewicht vorgeschlagen wird – sonst gilt einfach "Letztes Mal"
  if (sug.kind !== 'up') return plates ? `<div class="coach-plain">${plates}</div>` : '';
  const canUse = sug.w != null || sug.target != null;
  return `<div class="coach">
    <div class="coach-main">
      <span class="coach-label">Vorschlag heute: mehr Gewicht</span>
      <b class="coach-head">${esc(sug.head)}</b>
      <span class="coach-why">${esc(sug.why)}</span>
    </div>
    <div class="coach-actions">
      ${canUse ? '<button class="chip" data-action="useSug">Übernehmen</button>' : ''}
      ${plates}
    </div>
  </div>`;
}

function lastSetLine() {
  const pos = prevPos();
  const r = pos && active.items[pos.ex].results[pos.set];
  if (!r || r.status !== 'done') return `<p class="muted">${ICON.check} Satz gespeichert</p>`;
  return `<p class="muted saved-line">${ICON.check} Gespeichert: <button class="set-chip" data-action="editSet" data-ex="${pos.ex}" data-set="${pos.set}" aria-label="Letzten Satz ändern">${fmtSet(r, ' × ', exUnit(active.items[pos.ex].exId))}</button></p>`;
}

function viewRestPick() {
  return `${topbar('Pause')}
    ${progressBar()}
    <main class="content center-col">
      ${lastSetLine()}
      <button class="btn primary huge" data-action="startRest" data-sec="${active.restDefault}">
        <span class="huge-time">${fmtClock(active.restDefault)}</span><span class="huge-sub">Pause starten</span></button>
      <div class="custom-rest">
        <input id="customRest" class="input" inputmode="decimal" placeholder="Eigene Zeit (Min)" autocomplete="off" data-enter="startCustomRest">
        <button class="btn" data-action="startCustomRest">Start</button>
      </div>
      <div class="row center gap">
        <button class="text-btn muted" data-action="noRest">Ohne Pause weiter</button>
        <button class="text-btn muted" data-action="prevSet">${ICON.back} Satz zurück</button>
      </div>
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
      ${lastSetLine()}
      ${nextUpHtml()}
    </main>`;
}

function viewSummary() {
  const st = stats(active);
  const finished = isFinished();
  const rows = active.items.map((it, xi) => {
    const done = it.results.filter((r) => r?.status === 'done');
    const label = done.length === 0 ? '<span class="badge skip">übersprungen</span>'
      : done.length < it.sets ? `<span class="badge part">${done.length}/${it.sets}</span>`
      : '<span class="badge ok">gemacht</span>';
    const sets = setChips(xi, exUnit(it.exId));
    const skipped = it.results.map((r, i) => (r?.status === 'skipped' ? `<button class="set-chip skip" data-action="editSet" data-ex="${xi}" data-set="${i}" aria-label="Übersprungenen Satz ${i + 1} nachtragen">+ Satz ${i + 1}</button>` : '')).join('');
    const pr = done.some((r) => r.pr) ? `<span class="badge pr">${ICON.award} Rekord</span>` : '';
    return `<li><div class="sum-top"><span>${esc(it.name)}</span><span class="badges">${pr}${label}</span></div>${sets || skipped ? `<div class="sum-sets">${sets}${skipped}</div>` : ''}</li>`;
  }).join('');

  return `<header class="topbar"><span class="topbar-spacer"></span><span class="topbar-mid">Zusammenfassung</span><span class="topbar-spacer"></span></header>
    <main class="content has-footer-lg">
      <h2 class="sum-title">${esc(active.workoutName)}</h2>
      <p class="muted">${fmtDateLong(dateStr(new Date(active.startedAt)))}</p>
      <div class="stats">
        <button class="stat-btn" data-action="editDur" aria-label="Dauer ändern"><b>${fmtDurationLong(st.duration)}</b><span>Dauer ${ICON.edit}</span></button>
        <div><b>${st.sets}</b><span>Sätze</span></div>
        <div><b>${fmtVol(st.volume).replace(/ (kg|lb|t)$/, '')}</b><span>${fmtVol(st.volume).split(' ').pop()} Volumen</span></div>
      </div>
      <p class="muted small sum-hint">Falsch eingetragen? Satz antippen und ändern.</p>
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

// ---------- Reihenfolge für diese Sitzung ändern ----------
// Gerät besetzt? Übungen, die noch nicht begonnen sind, lassen sich frei
// verschieben. Der Plan selbst bleibt unverändert.

/** Indizes der Übungen, die noch verschoben werden dürfen. */
function movable() {
  if (!active || isFinished()) return [];
  const from = active.cur.set === 0 ? active.cur.ex : active.cur.ex + 1;
  return active.items.map((_, i) => i).filter((i) => i >= from);
}

function moveItem(from, to) {
  const [x] = active.items.splice(from, 1);
  active.items.splice(to, 0, x);
  persist();
}

/** Übung ist schon angefangen (mind. ein Satz erledigt oder übersprungen)? */
const started = (i) => i < active.cur.ex || (i === active.cur.ex && active.cur.set > 0) || active.items[i].results.some(Boolean);

function itemFrom(exId, base = {}) {
  const ex = getExercise(exId);
  return { exId, name: ex?.name || exId, primary: ex?.primary || [], secondary: ex?.secondary || [], uni: !!ex?.uni, sets: base.sets ?? 3, rest: base.rest ?? 120, results: [] };
}

/** Nach dem Entfernen/Tauschen der aktuellen Übung: Zustand aufräumen. */
function afterCurrentChanged() {
  active.prefill = null;
  if (isFinished()) { if (active.phase === 'rest') endRest(); toSummary(); }
}

const fmtRest = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec} s`);

/** „Training bearbeiten“: Reihenfolge, Übung hinzufügen/tauschen/entfernen, Sätze, Pause. Nur dieses Workout. */
function openEditSheet() {
  const draw = () => {
    const mv = movable();
    const first = mv[0];
    return active.items.map((it, i) => {
      const done = i < active.cur.ex;
      const running = i === active.cur.ex && active.cur.set > 0;
      const canMove = mv.includes(i);
      const state = done ? (justDone(i) ? 'erledigt · noch ein Satz möglich' : 'erledigt') : running ? `läuft · Satz ${active.cur.set + 1}/${it.sets}` : i === active.cur.ex ? `jetzt dran · ${it.sets} Sätze` : `${it.sets} Sätze · ${fmtRest(it.rest)}`;
      return `<li class="order-row${done ? ' done' : ''}${running || i === active.cur.ex ? ' cur' : ''}">
        <span class="order-n">${i + 1}</span>
        ${done && !justDone(i) ? `<span class="lr-main"><span class="lr-title">${esc(it.name)}</span><span class="lr-sub">${state}</span></span>`
          : `<button class="lr-main order-edit" data-action="item" data-i="${i}" aria-label="${esc(it.name)} bearbeiten"><span class="lr-title">${esc(it.name)}</span><span class="lr-sub">${state}</span></button>`}
        ${canMove ? `<span class="order-btns">
          ${i !== first ? `<button class="chip" data-action="first" data-i="${i}">${active.cur.set === 0 ? 'Jetzt' : 'Als Nächstes'}</button>` : ''}
          <button class="icon-btn sm" data-action="up" data-i="${i}" ${i === first ? 'disabled' : ''} aria-label="Nach oben">${ICON.up}</button>
          <button class="icon-btn sm" data-action="down" data-i="${i}" ${i === active.items.length - 1 ? 'disabled' : ''} aria-label="Nach unten">${ICON.down}</button>
        </span>` : ''}</li>`;
    }).join('');
  };
  const redraw = () => { const ul = document.getElementById('orderList'); if (ul) ul.innerHTML = draw(); };
  openSheet(`<h2 class="sheet-title">Training bearbeiten</h2>
    <p class="muted small sheet-sub">Übung antippen zum Ändern. Gilt nur für dieses Workout – dein Plan bleibt gleich.</p>
    <ol class="order-list" id="orderList">${draw()}</ol>
    <button class="btn ghost full add-ex" data-action="add">${ICON.plus} Übung hinzufügen</button>
    <div class="sheet-actions"><button class="btn primary big" data-action="done">Fertig</button></div>`, {
    up: (el) => { const i = +el.dataset.i; if (movable().includes(i - 1)) { moveItem(i, i - 1); redraw(); } },
    down: (el) => { const i = +el.dataset.i; if (i < active.items.length - 1) { moveItem(i, i + 1); redraw(); } },
    first: (el) => { moveItem(+el.dataset.i, movable()[0]); redraw(); },
    item: (el) => openItemSheet(+el.dataset.i),
    add: () => openExercisePicker({
      title: 'Übung hinzufügen', sub: 'Kommt ans Ende – Reihenfolge danach frei änderbar.', back: openEditSheet,
      onPick: (id) => {
        const ref = curItem() || active.items[active.items.length - 1];
        active.items.push(itemFrom(id, { sets: 3, rest: ref?.rest ?? 120 }));
        persist();
        toast(`${getExercise(id)?.name || 'Übung'} hinzugefügt`);
        openEditSheet();
      },
    }),
    done: () => { closeSheet(); transition(render); },
  });
}

/** Gerade fertig gewordene Übung (nächste noch nicht angefangen) → „noch ein Satz“ möglich. */
const justDone = (i) => i === active.cur.ex - 1 && active.cur.set === 0 && !(active.items[active.cur.ex]?.results.some(Boolean));

/** Eine Übung im laufenden Workout bearbeiten. */
function openItemSheet(i) {
  const it = active.items[i];
  if (!it) return openEditSheet();
  if (justDone(i)) {
    return openSheet(`<h2 class="sheet-title">${esc(it.name)}</h2>
      <p class="muted small sheet-sub">Schon fertig (${it.sets} Sätze). Noch einen dranhängen? Danach geht es normal weiter.</p>
      <div class="sheet-actions">
        <button class="btn primary big" data-action="more">${ICON.plus} Noch ein Satz</button>
        <button class="btn ghost big" data-action="back">Zurück</button>
      </div>`, {
      more: () => {
        active.cur = { ex: i, set: it.sets };
        it.sets++;
        active.prefill = null;
        persist();
        closeSheet();
        toast(`Satz ${it.sets} ${it.name}`);
        transition(render);
      },
      back: () => openEditSheet(),
    });
  }
  const isCur = i === active.cur.ex;
  const minSets = isCur ? active.cur.set + 1 : Math.max(1, it.results.filter(Boolean).length);
  const fresh = !started(i);
  const draw = () => `
    <div class="stepper-row"><span class="lr-main"><span class="lr-title">Sätze</span>${isCur && active.cur.set ? `<span class="lr-sub">${active.cur.set} schon gemacht</span>` : ''}</span>
      <button class="icon-btn" data-action="sets" data-d="-1" ${it.sets <= minSets ? 'disabled' : ''} aria-label="Ein Satz weniger">−</button>
      <b class="stepper-num">${it.sets}</b>
      <button class="icon-btn" data-action="sets" data-d="1" ${it.sets >= 10 ? 'disabled' : ''} aria-label="Ein Satz mehr">+</button></div>
    <div class="stepper-row"><span class="lr-main"><span class="lr-title">Pause</span></span>
      <button class="icon-btn" data-action="rest" data-d="-1" ${it.rest <= 0 ? 'disabled' : ''} aria-label="15 Sekunden weniger">−</button>
      <b class="stepper-num">${fmtRest(it.rest)}</b>
      <button class="icon-btn" data-action="rest" data-d="1" ${it.rest >= 600 ? 'disabled' : ''} aria-label="15 Sekunden mehr">+</button></div>`;
  const redraw = () => { const b = document.getElementById('itemBox'); if (b) b.innerHTML = draw(); };
  openSheet(`<h2 class="sheet-title">${esc(it.name)}</h2>
    <div id="itemBox">${draw()}</div>
    <div class="sheet-actions">
      ${fresh ? '<button class="btn ghost big" data-action="swap">Übung tauschen</button>' : ''}
      ${fresh && active.items.length > 1 ? '<button class="btn ghost big danger" data-action="remove">Aus diesem Workout entfernen</button>' : ''}
      <button class="btn primary big" data-action="back">Fertig</button>
    </div>
    ${!fresh ? '<p class="muted small center-text">Schon angefangen – Tauschen und Entfernen gehen nur vor dem ersten Satz. Sätze kannst du über die Satz-Chips ändern.</p>' : ''}`, {
    sets: (el) => { it.sets = Math.min(10, Math.max(minSets, it.sets + Number(el.dataset.d))); persist(); redraw(); },
    rest: (el) => { it.rest = Math.min(600, Math.max(0, it.rest + Number(el.dataset.d) * 15)); persist(); redraw(); },
    swap: () => openExercisePicker({
      title: 'Übung tauschen', sub: `Statt ${it.name} – Sätze und Pause bleiben.`, back: () => openItemSheet(i), exclude: [it.exId],
      onPick: (id) => {
        active.items[i] = itemFrom(id, { sets: it.sets, rest: it.rest });
        if (isCur) afterCurrentChanged();
        persist();
        toast(`Getauscht: ${getExercise(id)?.name || 'Übung'}`);
        openEditSheet();
      },
    }),
    remove: () => {
      active.items.splice(i, 1);
      if (isCur) afterCurrentChanged();
      persist();
      toast(`${it.name} entfernt`);
      if (active.phase === 'summary') { closeSheet(); transition(render); } else openEditSheet();
    },
    back: () => openEditSheet(),
  });
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

    focusReps: () => (document.getElementById('inR') || document.getElementById('inRL'))?.focus(),
    focusRight: () => document.getElementById('inRR')?.focus(),

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
      const u = exUnit(curItem().exId);
      const w = fromU(read(inW), u); // Eingabe in kg oder lb (pro Übung) → gespeichert wird kg
      let r, sides = null;
      if (curItem().uni) {
        const rl = read(document.getElementById('inRL')), rr = read(document.getElementById('inRR'));
        if ([rl, rr].some((x) => Number.isNaN(x) || (x !== null && !Number.isInteger(x)))) return toast('Wiederholungen bitte als ganze Zahlen');
        sides = [rl ?? rr ?? null, rr ?? rl ?? null];
        r = sides[0] == null ? null : Math.min(sides[0], sides[1]);
      } else {
        r = read(inR);
        if (Number.isNaN(r)) return toast('Bitte gültige Zahlen eingeben');
        if (r !== null && !Number.isInteger(r)) return toast('Wiederholungen bitte als ganze Zahl');
      }
      if (Number.isNaN(w)) return toast('Bitte gültige Zahlen eingeben');
      document.activeElement?.blur();
      const rec = completeSet(w, r, sides, u);
      transition(render);
      window.scrollTo(0, 0);
      if (rec) setTimeout(() => showRecord(rec), 350);
    },

    info: () => { const it = curItem(); openExerciseInfo(it.exId, it.name); },

    prevSet: () => {
      if (!backOneSet()) return toast('Noch kein Satz eingetragen');
      document.activeElement?.blur();
      transition(render);
      window.scrollTo(0, 0);
      toast('Satz zurück – Werte korrigieren');
    },

    editSet: (el) => openEditSet(+el.dataset.ex, +el.dataset.set),
    order: () => openEditSheet(),

    useSug: () => {
      const sug = suggest(curItem().exId);
      const inW = document.getElementById('inW');
      if (sug.w != null) inW.value = fmtWU(sug.w, exUnit(curItem().exId), false);
      if (sug.target != null) ['inR', 'inRL', 'inRR'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = sug.target; });
      toast('Vorschlag übernommen');
    },

    plates: () => {
      const v = parseNum(document.getElementById('inW')?.value);
      const ph = parseNum(document.getElementById('inW')?.placeholder);
      const u = exUnit(curItem().exId);
      const sw = suggest(curItem().exId).w;
      openPlates(v || (sw != null ? Number(fmtWU(sw, u, false).replace(/\./g, '').replace(',', '.')) : 0) || ph || null, u);
    },

    // kg ⇄ lb für diese Übung (z. B. Kabelturm in Pfund); eingetippter Wert wird umgerechnet
    unitToggle: (el, ev) => {
      ev?.preventDefault?.();
      const it = curItem();
      const old = exUnit(it.exId), nu = old === 'lb' ? 'kg' : 'lb';
      const inW = document.getElementById('inW');
      const typed = parseNum(inW?.value);
      const keep = { r: document.getElementById('inR')?.value, rl: document.getElementById('inRL')?.value, rr: document.getElementById('inRR')?.value };
      setExUnit(it.exId, nu);
      render();
      const w2 = document.getElementById('inW');
      if (w2 && typed != null && !Number.isNaN(typed)) w2.value = fmtWU(fromU(typed, old), nu, false);
      [['inR', keep.r], ['inRL', keep.rl], ['inRR', keep.rr]].forEach(([id, v]) => { const e = document.getElementById(id); if (e && v) e.value = v; });
      toast(`${it.name}: ${nu === 'lb' ? 'Pfund (lb)' : 'Kilogramm (kg)'}`);
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
      armRestPush(); // Mitteilung auf die neue Endzeit verschieben
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

    // Dauer in der Zusammenfassung korrigieren (z. B. vergessen zu beenden)
    editDur: () => {
      const cur = Math.max(1, Math.round(((active.endedAt || Date.now()) - active.startedAt) / 60000));
      openSheet(`<h2 class="sheet-title">Dauer ändern</h2>
        <p class="muted small sheet-sub">Begonnen um ${new Date(active.startedAt).toTimeString().slice(0, 5)} Uhr. Zum Beispiel 75 oder 1:15.</p>
        <label class="gfield"><span>Dauer (Minuten)</span><input id="durIn" inputmode="numeric" value="${cur}" autocomplete="off" data-enter="saveDur"></label>
        <div class="sheet-actions"><button class="btn primary big" data-action="saveDur">Speichern</button></div>`, {
        saveDur: () => {
          const min = parseMinutes(document.getElementById('durIn').value);
          if (!(min >= 1 && min <= 600)) return toast('Dauer in Minuten eingeben (1–600)');
          active.endedAt = active.startedAt + min * 60000;
          persist();
          closeSheet();
          render();
          toast('Dauer geändert');
        },
      });
      setTimeout(() => document.getElementById('durIn')?.select(), 350);
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
          ...(it.uni ? { uni: true } : {}),
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
