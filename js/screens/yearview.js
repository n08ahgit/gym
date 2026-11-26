// =============================================================
// yearview.js – große Jahresansicht (öffnet sich aus dem Jahresraster)
//
// 12 Monatskalender mit Tageszahlen in den Statusfarben, oben die
// Jahreszahlen. Tag antippen → Fenster mit dem, was an dem Tag war.
// =============================================================

import { go, render, ui, openSheet } from '../app.js';
import { data, sessionsByDate, planVersionFor, currentVersion, plannedOf } from '../store.js';
import { addDays, dateStr, parseDate, weekdayIdx, WD_SHORT, WEEKDAYS, fmtDateLong, fmtDurationLong, fmtNum, fmtBig, esc } from '../util.js';
import { dayStatus } from '../year.js';
import { ICON } from './icons.js';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const LABEL = { done: 'Trainiert', rest: 'Pausetag', missed: 'Verpasst', open: 'Heute geplant', future: 'Geplant', none: 'Kein Plan' };

function yearCounts(year, today, byDate) {
  const c = { done: 0, rest: 0, missed: 0 };
  for (let d = new Date(year, 0, 1); d.getFullYear() === year && dateStr(d) <= today; d = addDays(d, 1)) {
    const st = dayStatus(dateStr(d), today, byDate);
    if (c[st] != null) c[st]++;
  }
  return c;
}

function month(year, m, today, byDate, sel) {
  const first = new Date(year, m, 1);
  const lead = weekdayIdx(first);
  let cells = '<span class="ym-pad"></span>'.repeat(lead);
  for (let d = first; d.getMonth() === m; d = addDays(d, 1)) {
    const ds = dateStr(d);
    const st = dayStatus(ds, today, byDate);
    cells += `<button class="ym-day s-${st}${ds === today ? ' is-today' : ''}${ds === sel ? ' sel' : ''}" data-action="day" data-date="${ds}" aria-label="${fmtDateLong(ds)}: ${LABEL[st]}">${d.getDate()}</button>`;
  }
  return `<section class="ym" id="m${m}"><h3>${MONTHS[m]}</h3>
    <div class="ym-grid">${WD_SHORT.map((w) => `<span class="ym-wd">${w[0]}</span>`).join('')}${cells}</div></section>`;
}

export const yearScreen = {
  render({ year, sel }) {
    const now = new Date();
    year = year || now.getFullYear();
    const today = dateStr();
    const byDate = sessionsByDate();
    const c = yearCounts(year, today, byDate);
    const planned = c.done + c.missed;
    const thisYear = now.getFullYear();
    const firstYear = Math.min(thisYear, ...data.sessions.map((s) => +s.date.slice(0, 4)), ...data.planVersions.map((v) => +v.from.slice(0, 4)));
    const months = Array.from({ length: 12 }, (_, m) => month(year, m, today, byDate, sel)).join('');
    return `<header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid year-switch">
          <button class="icon-btn sm" data-action="prev" ${year <= firstYear ? 'disabled' : ''} aria-label="Vorjahr">${ICON.chevL}</button>
          <b>${year}</b>
          <button class="icon-btn sm" data-action="next" ${year >= thisYear ? 'disabled' : ''} aria-label="Nächstes Jahr">${ICON.chevR}</button>
        </span>
        <span class="topbar-spacer"></span>
      </header>
      <main class="content yearview">
        <div class="tiles three">
          <div class="tile"><span class="tile-label">Trainiert</span><span class="tile-value">${c.done}</span><span class="tile-sub">Tage</span></div>
          <div class="tile"><span class="tile-label">Verpasst</span><span class="tile-value">${c.missed}</span><span class="tile-sub">Tage</span></div>
          <div class="tile"><span class="tile-label">Plan erfüllt</span><span class="tile-value">${planned ? Math.round((c.done / planned) * 100) : 0} %</span><span class="tile-sub">${c.rest} Pausetage</span></div>
        </div>
        <div class="legend ym-legend">
          <span><i class="s-done"></i>Trainiert</span><span><i class="s-rest"></i>Pause</span>
          <span><i class="s-missed"></i>Verpasst</span><span><i class="s-future"></i>Offen</span>
        </div>
        <div class="ym-months">${months}</div>
      </main>`;
  },

  after(root, params) {
    // Zum aktuellen bzw. gewählten Monat scrollen
    const ds = params.sel || (params.year && params.year !== new Date().getFullYear() ? null : dateStr());
    if (!ds) return;
    const el = root.querySelector(`#m${+ds.slice(5, 7) - 1}`);
    // nach dem Bildschirmwechsel (der scrollt sonst wieder nach oben)
    if (el && +ds.slice(5, 7) > 2) setTimeout(() => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120), 0);
  },

  actions: {
    back: () => go('home', { year: ui.params.year, sel: ui.params.sel }),
    prev: () => { ui.params.year = (ui.params.year || new Date().getFullYear()) - 1; ui.params.sel = null; render(); window.scrollTo(0, 0); },
    next: () => { ui.params.year = (ui.params.year || new Date().getFullYear()) + 1; ui.params.sel = null; render(); window.scrollTo(0, 0); },
    day: (el) => {
      document.querySelectorAll('.ym-day.sel').forEach((x) => x.classList.remove('sel'));
      el.classList.add('sel');
      ui.params.sel = el.dataset.date;
      openDay(el.dataset.date);
    },
  },
};

/** Fenster: was war an diesem Tag? */
function openDay(ds) {
  const today = dateStr();
  const byDate = sessionsByDate();
  const st = dayStatus(ds, today, byDate);
  const wd = weekdayIdx(parseDate(ds));
  let body = '';
  if (st === 'done') {
    body = byDate.get(ds).map((s) => {
      const done = s.exercises.map((e) => ({ name: e.name, sets: e.sets.filter((x) => x.status === 'done') })).filter((e) => e.sets.length);
      const vol = done.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.w || 0) * (x.r || 0), 0), 0);
      const n = done.reduce((a, e) => a + e.sets.length, 0);
      return `<p class="muted small sheet-sub">${esc(s.workoutName)} · ${fmtDurationLong(s.end - s.start)} · ${n} Sätze · ${fmtBig(vol)} kg</p>
        <ul class="sheet-list">${done.map((e) => `<li><span>${esc(e.name)}</span><span class="muted">${e.sets.map((x) => `${fmtNum(x.w)}×${fmtNum(x.r)}`).join(' · ')}</span></li>`).join('')}</ul>`;
    }).join('');
  } else {
    const w = plannedOf(st === 'future' ? currentVersion() : planVersionFor(ds), ds);
    const text = {
      rest: 'Pausetag – laut Plan kein Training.',
      missed: `Verpasst – geplant war ${esc(w?.name || '')}.`,
      open: `Heute geplant: ${esc(w?.name || '')}.`,
      future: w ? `Geplant: ${esc(w.name)} (${w.exercises.length} Übungen).` : 'Pausetag laut aktuellem Plan.',
      none: 'An diesem Tag gab es noch keinen Plan.',
    }[st];
    body = `<p class="muted">${text}</p>`;
  }
  openSheet(`<h2 class="sheet-title">${WEEKDAYS[wd]}, ${parseDate(ds).getDate()}. ${MONTHS[parseDate(ds).getMonth()]}</h2>
    <p class="ym-status s-${st}-text">${LABEL[st]}</p>${body}`);
}
