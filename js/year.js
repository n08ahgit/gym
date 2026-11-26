// =============================================================
// year.js – Jahresübersicht (Raster wie bei GitHub)
//
// Spalten = Wochen (Mo–So), Zeilen = Wochentage.
// Status eines Tages (dayStatus):
//   done    grün   – Workout gespeichert
//   rest    gelb   – laut damals gültigem Plan Pausetag
//   missed  rot    – geplant, vorbei, nichts gespeichert
//   open    grau mit Rand – heute geplant, noch nicht erledigt
//   future  grau   – Zukunft
//   none    grau   – vor dem ersten Plan
// =============================================================

import { addDays, dateStr, weekdayIdx, MONTHS_SHORT, fmtDateLong, fmtDurationLong, esc, parseDate } from './util.js';
import { data, planVersionFor, sessionsByDate, currentPlan } from './store.js';
import { ICON } from './screens/icons.js';

/** Text für Bildschirmleser (Farbe allein reicht nicht). */
const STATUS_LABEL = {
  done: 'trainiert', rest: 'Pausetag', missed: 'verpasst', open: 'heute geplant', future: 'Zukunft', none: 'kein Plan',
};

/** Status eines Tages. byDate = Map aus sessionsByDate(). */
export function dayStatus(ds, today, byDate) {
  if (byDate.get(ds)?.length) return 'done';
  if (ds > today) return 'future';
  const v = planVersionFor(ds);
  if (!v) return 'none';
  const planned = v.days[weekdayIdx(parseDate(ds))];
  if (!planned) return 'rest';
  return ds === today ? 'open' : 'missed';
}

/** HTML für das Raster eines Jahres. */
export function renderYear(year) {
  const today = dateStr();
  const byDate = sessionsByDate();
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = addDays(jan1, -weekdayIdx(jan1)); // Montag vor/am 1.1.

  let cells = '';
  let months = '';
  let col = 0;
  let count = 0;
  let todayCol = -1;
  for (let wk = new Date(start); wk <= dec31; wk = addDays(wk, 7), col++) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(wk, i);
      const ds = dateStr(d);
      if (d.getFullYear() !== year) {
        cells += '<span class="cell out"></span>';
        continue;
      }
      if (d.getDate() === 1) months += `<span style="grid-column:${col + 1}">${MONTHS_SHORT[d.getMonth()]}</span>`;
      const st = dayStatus(ds, today, byDate);
      if (st === 'done') count++;
      if (ds === today) todayCol = col;
      cells += `<button class="cell s-${st}${ds === today ? ' is-today' : ''}" data-action="dayInfo" data-date="${ds}" aria-label="${fmtDateLong(ds)}: ${STATUS_LABEL[st]}"></button>`;
    }
  }

  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(thisYear, ...data.sessions.map((s) => +s.date.slice(0, 4)), ...data.planVersions.map((v) => +v.from.slice(0, 4)));

  return `
    <div class="year-head">
      <button class="icon-btn sm" data-action="yearPrev" ${year <= firstYear ? 'disabled' : ''} aria-label="Vorjahr">${ICON.chevL}</button>
      <button class="year-open" data-action="openYear"><b>${year}</b> · ${count} ${count === 1 ? 'Training' : 'Trainings'} ${ICON.chev}</button>
      <button class="icon-btn sm" data-action="yearNext" ${year >= thisYear ? 'disabled' : ''} aria-label="Nächstes Jahr">${ICON.chevR}</button>
    </div>
    <div class="year-scroll" data-today-col="${todayCol}">
      <div class="year-months" style="grid-template-columns:repeat(${col},var(--cell))">${months}</div>
      <div class="year-grid">${cells}</div>
    </div>
    <div class="legend">
      <span><i class="s-done"></i>Trainiert</span><span><i class="s-rest"></i>Pause</span>
      <span><i class="s-missed"></i>Verpasst</span><span><i class="s-future"></i>Offen</span>
    </div>
    <div class="year-info">
      <button class="icon-btn sm" data-action="dayStep" data-d="-1" aria-label="Vorheriger Tag">${ICON.chevL}</button>
      <span class="year-info-text" id="yearInfo" aria-live="polite"></span>
      <button class="icon-btn sm" data-action="dayStep" data-d="1" aria-label="Nächster Tag">${ICON.chevR}</button>
    </div>`;
}

/** Text: was war an diesem Tag? */
export function dayInfoText(ds) {
  const today = dateStr();
  const byDate = sessionsByDate();
  const st = dayStatus(ds, today, byDate);
  const head = `<b>${fmtDateLong(ds)}</b> · `;
  const wd = weekdayIdx(parseDate(ds));
  if (st === 'done') {
    return head + byDate.get(ds).map((s) => {
      const sets = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.status === 'done').length, 0);
      return `${esc(s.workoutName)} – ${sets} Sätze, ${fmtDurationLong(s.end - s.start)}`;
    }).join(' · ');
  }
  if (st === 'future') {
    const w = currentPlan()[wd];
    return head + (w ? `Geplant: ${esc(w.name)}` : 'Pausetag');
  }
  if (st === 'none') return head + 'Noch kein Plan aktiv';
  if (st === 'rest') return head + 'Pausetag';
  const w = planVersionFor(ds).days[wd];
  return head + (st === 'open' ? `Heute geplant: ${esc(w.name)}` : `Verpasst – geplant war ${esc(w.name)}`);
}

/** Nach dem Rendern: heutigen Tag in die Mitte scrollen. */
export function scrollYearToToday(root) {
  const sc = root.querySelector('.year-scroll');
  if (!sc) return;
  const col = Number(sc.dataset.todayCol);
  const cellW = parseFloat(getComputedStyle(sc).getPropertyValue('--cell')) + 3 || 16;
  // Vergangene Jahre: ans Ende (Dezember) scrollen
  sc.scrollLeft = col >= 0 ? col * cellW - sc.clientWidth / 2 : sc.scrollWidth;
}
