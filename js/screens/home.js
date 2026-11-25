// =============================================================
// home.js – Hauptbildschirm: Jahresübersicht, Wochenplan, Workout-Leiste
// =============================================================

import { go, render, openSheet, closeSheet, ask, ui } from '../app.js';
import { currentPlan, data, sessionsByDate } from '../store.js';
import { WEEKDAYS, WD_SHORT, dateStr, parseDate, addDays, weekdayIdx, esc, fmtClock } from '../util.js';
import { renderYear, dayInfoText, scrollYearToToday } from '../year.js';
import { getActive, startWorkout, discardActive } from './workout.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';
import { computeStreak, flameSvg, TIERS } from '../streak.js';
import { exportDue, exportFile, daysSinceExport } from '../backup.js';

export const homeScreen = {
  render(params) {
    const plan = currentPlan();
    const today = new Date();
    const tIdx = weekdayIdx(today);
    const doneToday = sessionsByDate().has(dateStr(today));
    const year = params.year || today.getFullYear();
    const active = getActive();
    const empty = !data.planVersions.length;

    const days = plan
      .map((w, i) => {
        const isToday = i === tIdx;
        const right = (isToday ? '<span class="today-pill">Heute</span>' : '') +
          (isToday && doneToday ? `<span class="day-check" aria-label="erledigt">${ICON.check}</span>` : `<span class="chev">${ICON.chev}</span>`);
        return `<button class="day${isToday ? ' today' : ''}${w ? '' : ' rest'}" data-action="openDay" data-idx="${i}">
          <span class="day-short">${WD_SHORT[i]}</span>
          <span class="day-main">
            <span class="day-title">${w ? esc(w.name) : 'Pause'}</span>
            ${w ? `<span class="day-sub">${w.exercises.length} ${w.exercises.length === 1 ? 'Übung' : 'Übungen'}</span>` : ''}
          </span>${right}</button>`;
      })
      .join('');

    return `
      <main class="content no-title has-tabbar home${active ? ' has-bar' : ''}${firstPaint ? ' enter' : ''}">
        ${streakCard()}
        ${todayCard(plan, tIdx, doneToday, active)}
        ${exportDue() ? backupNudge() : ''}
        <section class="card year">${renderYear(year)}</section>
        ${empty ? '<p class="hint">Tippe auf einen Wochentag, um dein erstes Workout anzulegen.</p>' : ''}
        <h2 class="group-header">Wochenplan</h2>
        <section class="week">${days}</section>
      </main>
      ${active ? activeBar(active) : ''}
      ${tabBar('home')}`;
  },

  after(root, params) {
    scrollYearToToday(root);
    // Ausgewählten Tag (Standard: heute) markieren und beschreiben
    const year = params.year || new Date().getFullYear();
    let sel = params.sel;
    if (!sel || +sel.slice(0, 4) !== year) sel = year === new Date().getFullYear() ? dateStr() : `${year}-12-31`;
    selectDay(sel);
  },

  actions: {
    settings: () => go('settings'),
    resume: () => go('workout'),
    yearPrev: () => { ui.params.year = (ui.params.year || new Date().getFullYear()) - 1; render(); },
    yearNext: () => { ui.params.year = (ui.params.year || new Date().getFullYear()) + 1; render(); },
    dayInfo: (el) => selectDay(el.dataset.date),
    // Große Pfeile neben der Info: Tag für Tag durchgehen (die Kästchen
    // selbst sind kleiner als die empfohlene Tippfläche)
    dayStep: (el) => {
      const cur = ui.params.sel || dateStr();
      const next = dateStr(addDays(parseDate(cur), Number(el.dataset.d)));
      const y = +next.slice(0, 4);
      if (y !== (ui.params.year || new Date().getFullYear())) {
        if (y > new Date().getFullYear()) return;
        ui.params.year = y;
        ui.params.sel = next;
        render();
      } else selectDay(next);
    },
    openDay: (el) => openDaySheet(Number(el.dataset.idx)),
    backupNow: async () => { if (await exportFile()) render(); },
    startToday: () => {
      const idx = weekdayIdx(new Date());
      startWorkout(idx, currentPlan()[idx]);
      go('workout');
    },
  },
};

/** Dezente Erinnerung an die Datei-Sicherung (iCloud Drive / Dateien). */
function backupNudge() {
  const d = daysSinceExport();
  return `<button class="nudge" data-action="backupNow">
    <span class="nudge-icon">${ICON.share}</span>
    <span class="lr-main"><span class="lr-title">Backup sichern</span>
      <span class="lr-sub">${d === Infinity ? 'Noch keine Sicherung außerhalb des iPhones' : `Letzte Sicherung vor ${d} Tagen`} · in iCloud Drive</span></span>
    <span class="chev">${ICON.chev}</span></button>`;
}

/** Karte "Heute": das heutige Workout mit direktem Start, oder Pausetag + nächstes Training. */
/** Nur beim ersten Anzeigen nach dem App-Start: Karten kommen gestaffelt herein. */
let firstPaint = true;
setTimeout(() => { firstPaint = false; }, 1500);

/** Streak-Karte: Flamme, Zahl, Status für heute, Woche, nächster Meilenstein, Schutz. */
function streakCard() {
  const s = computeStreak();
  if (!data.planVersions.length && !data.sessions.length) return '';
  const pending = s.todayState === 'pending';
  const dim = pending || s.current === 0;
  const tierName = TIERS[s.tier].name;
  const status = s.current === 0
    ? (pending ? 'Trainiere heute und entfache deine Flamme.' : 'Starte heute eine neue Streak.')
    : pending ? 'Heute noch trainieren – sonst erlischt deine Flamme.'
    : s.todayState === 'rest' ? 'Pausetag – zählt mit. Erholung gehört dazu.'
    : 'Heute erledigt. Deine Streak ist sicher.';
  const week = s.week.map((d) => {
    const inner = d.state === 'done' || d.state === 'rest' ? ICON.check : d.state === 'frozen' ? ICON.shield : '';
    return `<span class="wk wk-${d.state}"><span class="wk-dot">${inner}</span><span class="wk-l">${d.label}</span></span>`;
  }).join('');
  const shields = Array.from({ length: 2 }, (_, i) => `<span class="shield${i < s.freezes ? ' on' : ''}">${ICON.shield}</span>`).join('');
  return `<section class="card streak-card t${s.tier}${pending ? ' pending' : ''}">
    <div class="streak-top">
      <div class="streak-flame">${flameSvg(s.tier, { size: 52, dim, id: 'hf' })}</div>
      <div class="streak-num">
        <span class="streak-count" data-count="${s.current}">${s.current}</span>
        <span class="streak-label">${s.current === 1 ? 'Tag' : 'Tage'} Streak <span class="tier-pill">${tierName}</span></span>
      </div>
    </div>
    <p class="streak-status">${status}</p>
    <div class="streak-week">${week}</div>
    <div class="streak-foot">
      <div class="streak-next"><span>Noch ${s.next - s.current} ${s.next - s.current === 1 ? 'Tag' : 'Tage'} bis ${s.next}</span>
        <span class="bar"><i style="width:${Math.round(s.progress * 100)}%"></i></span></div>
      <div class="streak-shields" aria-label="${s.freezes} von 2 Streak-Schutz">${shields}<span>Schutz</span></div>
    </div>
  </section>`;
}

function todayCard(plan, tIdx, doneToday, active) {
  const w = plan[tIdx];
  if (!data.planVersions.length) return '';
  if (active) {
    return `<section class="card today-card">
      <h2 class="today-title">${esc(active.workoutName)}</h2><p class="muted small">Heute · Workout läuft</p>
      <button class="btn primary big" data-action="resume">${ICON.play} Fortsetzen</button></section>`;
  }
  if (w && w.exercises.length) {
    const sets = w.exercises.reduce((n, e) => n + e.sets, 0);
    return `<section class="card today-card">
      <h2 class="today-title">${esc(w.name)}</h2>
      <p class="muted small">Heute · ${w.exercises.length} Übungen · ${sets} Sätze${doneToday ? ' · heute schon erledigt' : ''}</p>
      <button class="btn ${doneToday ? '' : 'primary '}big" data-action="startToday">${ICON.play} ${doneToday ? 'Nochmal starten' : 'Workout starten'}</button></section>`;
  }
  // Pausetag: nächstes geplantes Training zeigen
  let next = null;
  for (let i = 1; i <= 7; i++) { const k = (tIdx + i) % 7; if (plan[k]) { next = [k, plan[k]]; break; } }
  return `<section class="card today-card rest">
    <h2 class="today-title">Heute Pausetag</h2>
    <p class="muted small">${next ? `Nächstes Training: ${WEEKDAYS[next[0]]} · ${esc(next[1].name)}` : 'Erholung gehört zum Training.'}</p></section>`;
}

/** Tag im Raster markieren, Info anzeigen und sichtbar scrollen. */
function selectDay(ds) {
  ui.params.sel = ds;
  document.querySelectorAll('.cell.sel').forEach((c) => c.classList.remove('sel'));
  const cell = document.querySelector(`.cell[data-date="${ds}"]`);
  if (cell) {
    if (!cell.classList.contains('is-today')) cell.classList.add('sel');
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const info = document.getElementById('yearInfo');
  if (info) info.innerHTML = dayInfoText(ds);
}

/** Leiste "Workout läuft · 23:41 – Fortsetzen" (Zeiten aktualisiert workoutTick). */
function activeBar(a) {
  const rest = a.phase === 'rest' ? ` · Pause <span data-bind="countdown">${fmtClock((a.rest.end - Date.now()) / 1000)}</span>` : '';
  return `<button class="active-bar" data-action="resume">
    <span class="pulse"></span>
    <span class="active-bar-text">Workout läuft · <span data-bind="elapsed">00:00</span>${rest}</span>
    <span class="active-bar-cta">Fortsetzen</span></button>`;
}

/** Bottom-Sheet für einen Wochentag: Übungen anzeigen, Start/Bearbeiten. */
function openDaySheet(idx) {
  const w = currentPlan()[idx];
  const active = getActive();
  const list = w && w.exercises.length
    ? `<ol class="sheet-list">${w.exercises.map((e) => `<li><span>${esc(e.name)}</span><span class="muted">${e.sets} × · ${fmtClock(e.rest)}</span></li>`).join('')}</ol>`
    : w ? '<p class="muted">Noch keine Übungen.</p>' : '<p class="muted">Pausetag – kein Training geplant.</p>';

  const startBtn = w && w.exercises.length
    ? `<button class="btn ${active ? '' : 'primary '}big" data-action="start">${active ? 'Neu starten' : 'Start'}</button>` : '';

  openSheet(
    `<h2 class="sheet-title">${WEEKDAYS[idx]}${w ? ` · ${esc(w.name)}` : ''}</h2>
     ${list}
     <div class="sheet-actions">
       ${active ? '<button class="btn primary big" data-action="resume">Laufendes Workout fortsetzen</button>' : ''}
       ${startBtn}
       <button class="btn big" data-action="edit">${w ? 'Bearbeiten' : 'Workout anlegen'}</button>
     </div>`,
    {
      resume: () => go('workout'),
      edit: () => go('edit', { idx }),
      start: async () => {
        if (active) {
          closeSheet();
          if (!(await ask('Laufendes Workout abbrechen?', 'Das aktuelle Workout wird verworfen und ein neues gestartet.', 'Neu starten', true))) return;
          discardActive();
        }
        startWorkout(idx, w);
        go('workout');
      },
    }
  );
}
