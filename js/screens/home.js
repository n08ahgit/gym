// =============================================================
// home.js – Hauptbildschirm: Jahresübersicht, Plan (Woche oder Rhythmus),
//           Workout-Leiste
// =============================================================

import { go, render, openSheet, closeSheet, ask, ui, toast } from '../app.js';
import { currentPlan, data, sessionsByDate, setPlanDays, currentVersion, currentCycle, planIndex, plannedOf, dayLabel, setPlanCycle, setPlanWeekly } from '../store.js';
import { PRESETS } from '../presets.js';
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
    const cycle = currentCycle();
    const today = new Date();
    const tIdx = planIndex(currentVersion() || { days: plan }, dateStr(today));
    const doneToday = sessionsByDate().has(dateStr(today));
    const year = params.year || today.getFullYear();
    const active = getActive();
    const empty = !data.planVersions.length;

    const days = plan
      .map((w, i) => {
        const isToday = i === tIdx;
        const right = (isToday ? '<span class="today-pill">Heute</span>' : '') +
          (isToday && doneToday ? `<span class="day-check" aria-label="erledigt">${ICON.check}</span>` : `<span class="chev">${ICON.chev}</span>`);
        const sub = [w ? `${w.exercises.length} ${w.exercises.length === 1 ? 'Übung' : 'Übungen'}` : '', cycle && !isToday ? `nächstes Mal ${nextDateLabel(i, plan.length, tIdx)}` : ''].filter(Boolean).join(' · ');
        return `<button class="day${isToday ? ' today' : ''}${w ? '' : ' rest'}" data-action="openDay" data-idx="${i}">
          <span class="day-short">${cycle ? i + 1 : WD_SHORT[i]}</span>
          <span class="day-main">
            <span class="day-title">${w ? esc(w.name) : 'Pause'}</span>
            ${sub ? `<span class="day-sub">${sub}</span>` : ''}
          </span>${right}</button>`;
      })
      .join('');

    return `
      <main class="content no-title has-tabbar home${active ? ' has-bar' : ''}${firstPaint ? ' enter' : ''}">
        ${streakCard()}
        ${todayCard(plan, tIdx, doneToday, active)}
        ${exportDue() ? backupNudge() : ''}
        <section class="card year">${renderYear(year)}</section>
        ${empty ? '<p class="hint">Tippe auf einen Tag, um dein erstes Workout anzulegen – oder wähle oben rechts eine Vorlage wie Push · Pull · Legs.</p>' : ''}
        <div class="group-row"><h2 class="group-header">${cycle ? `Rhythmus · ${plan.length} Tage` : 'Wochenplan'}</h2>
          <button class="chip" data-action="planType">${cycle ? 'Anpassen' : 'Plan-Art'}</button></div>
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
    // Kästchen oder Jahreszahl antippen → große Jahresansicht (Tag vorausgewählt)
    dayInfo: (el) => go('year', { year: ui.params.year || new Date().getFullYear(), sel: el.dataset.date }),
    openYear: () => go('year', { year: ui.params.year || new Date().getFullYear() }),
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
      const idx = planIndex(currentVersion(), dateStr());
      startWorkout(idx, currentPlan()[idx]);
      go('workout');
    },
    planType: () => openPlanTypeSheet(),
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
  // Pausetag: nächstes geplantes Training zeigen (funktioniert für Woche und Rhythmus)
  let next = null;
  for (let k = 1; k <= 14 && !next; k++) {
    const ds = dateStr(addDays(new Date(), k));
    const nw = plannedOf(currentVersion(), ds);
    if (nw) next = [ds, nw, k];
  }
  const when = next ? (next[2] === 1 ? 'Morgen' : `${WEEKDAYS[weekdayIdx(parseDate(next[0]))]}`) : '';
  return `<section class="card today-card rest">
    <h2 class="today-title">Heute Pausetag</h2>
    <p class="muted small">${next ? `Nächstes Training: ${when} · ${esc(next[1].name)}` : 'Erholung gehört zum Training.'}</p></section>`;
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
    `<h2 class="sheet-title">${dayLabel(idx)}${w ? ` · ${esc(w.name)}` : ''}</h2>
     ${list}
     <div class="sheet-actions">
       ${active ? '<button class="btn primary big" data-action="resume">Laufendes Workout fortsetzen</button>' : ''}
       ${startBtn}
       <button class="btn big" data-action="edit">${w ? 'Bearbeiten' : 'Workout anlegen'}</button>
       ${w && w.exercises.length ? '<button class="btn ghost big" data-action="copy">Auf andere Tage kopieren</button>' : ''}
     </div>`,
    {
      resume: () => go('workout'),
      copy: () => openCopySheet(idx),
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

/** Workout eines Tages auf andere Wochentage kopieren (eigenständige Kopien). */
function openCopySheet(idx) {
  const plan = currentPlan();
  const w = plan[idx];
  const sel = new Set();
  const chips = plan.map((_, i) => dayLabel(i)).map((name, i) => i === idx ? '' :
    `<button class="copy-day" data-action="pick" data-i="${i}" aria-pressed="false">
      <span class="copy-day-name">${name}</span>
      <span class="copy-day-now">${plan[i] ? esc(plan[i].name) : 'Pause'}</span>
      <span class="copy-check">${ICON.check}</span></button>`).join('');
  openSheet(`<h2 class="sheet-title">„${esc(w.name)}“ kopieren</h2>
    <p class="muted small sheet-sub">Auf welche Tage? Übungen, Sätze und Pausen werden übernommen.</p>
    <div class="copy-days">${chips}</div>
    <div class="sheet-actions"><button class="btn primary big" data-action="doCopy" id="copyBtn" disabled>Kopieren</button></div>`, {
    pick: (el) => {
      const i = Number(el.dataset.i);
      if (sel.has(i)) sel.delete(i); else sel.add(i);
      el.setAttribute('aria-pressed', sel.has(i));
      const btn = document.getElementById('copyBtn');
      btn.disabled = !sel.size;
      btn.textContent = sel.size ? `Auf ${sel.size} ${sel.size === 1 ? 'Tag' : 'Tage'} kopieren` : 'Kopieren';
    },
    doCopy: async () => {
      const days = [...sel].sort();
      const over = days.filter((i) => plan[i]);
      closeSheet();
      if (over.length && !(await ask('Bestehende Workouts ersetzen?', `${over.map((i) => `${dayLabel(i)} (${plan[i].name})`).join(', ')} ${over.length === 1 ? 'wird' : 'werden'} durch „${w.name}“ ersetzt. Vergangene Tage bleiben unverändert.`, 'Ersetzen', true))) return;
      setPlanDays(Object.fromEntries(days.map((i) => [i, w])));
      toast(`„${w.name}“ auf ${days.map((i) => (currentCycle() ? `Tag ${i + 1}` : WD_SHORT[i])).join(', ')} kopiert`);
      render();
    },
  });
}

/** "morgen" / "Fr 28.11." – wann Tag i des Rhythmus das nächste Mal dran ist. */
function nextDateLabel(i, n, tIdx) {
  const k = ((i - tIdx) % n + n) % n || n;
  if (k === 1) return 'morgen';
  const d = addDays(new Date(), k);
  return `${WD_SHORT[weekdayIdx(d)]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

// ---------- Plan-Art: Wochenplan oder Rhythmus ----------

function openPlanTypeSheet() {
  const cycle = currentCycle();
  const plan = currentPlan();
  const tIdx = cycle ? planIndex(currentVersion(), dateStr()) : 0;
  const presets = PRESETS.map((p) => `<button class="drink" data-action="preset" data-id="${p.id}">
      <span><span class="drink-name">${p.name}</span><br><span class="muted small">${p.sub}</span></span>${ICON.chev}</button>`).join('');
  const cycleTools = cycle ? `
    <h3 class="sheet-h">Heute ist</h3>
    <div class="today-pick">${plan.map((w, i) => `<button class="seg-item${i === tIdx ? ' on' : ''}" data-action="shift" data-i="${i}">Tag ${i + 1}<small>${w ? esc(w.name) : 'Pause'}</small></button>`).join('')}</div>
    <p class="note">Einen Tag ausgelassen oder verschoben? Hier einstellen, der Rhythmus läuft ab heute von dort weiter.</p>
    <h3 class="sheet-h">Länge</h3>
    <div class="row"><button class="btn" data-action="addDay" ${plan.length >= 10 ? 'disabled' : ''}>${ICON.plus} Tag anhängen</button>
      <button class="btn" data-action="removeDay" ${plan.length <= 2 ? 'disabled' : ''}>${ICON.minus} Letzten Tag entfernen</button></div>` : '';
  openSheet(`<h2 class="sheet-title">${cycle ? 'Rhythmus anpassen' : 'Plan-Art'}</h2>
    <p class="muted small sheet-sub">${cycle ? 'Dein Plan läuft im Kreis – unabhängig vom Wochentag.' : 'Jetzt: fester Wochenplan (Mo–So). Für Push · Pull · Legs mit Pausen lieber einen Rhythmus nehmen – der läuft im Kreis, egal welcher Wochentag ist.'}</p>
    ${cycleTools}
    <h3 class="sheet-h">${cycle ? 'Neuer Rhythmus aus Vorlage' : 'Rhythmus aus Vorlage'}</h3>
    <div class="drinks">${presets}
      <button class="drink" data-action="custom"><span><span class="drink-name">Eigener Rhythmus</span><br><span class="muted small">2–10 Tage, Workouts selbst anlegen</span></span>${ICON.chev}</button></div>
    ${cycle ? '<div class="sheet-actions"><button class="btn ghost big" data-action="toWeek">Zurück zum Wochenplan (Mo–So)</button></div>' : ''}
    <p class="note">Vergangene Tage im Jahresraster bleiben unverändert – die Änderung gilt ab heute.</p>`, {
    preset: async (el) => {
      const p = PRESETS.find((x) => x.id === el.dataset.id);
      closeSheet();
      if (data.planVersions.length && !(await ask(`„${p.name}“ starten?`, 'Dein aktueller Plan wird ab heute ersetzt. Heute ist dann Tag 1. Übungen kannst du danach anpassen.', 'Starten'))) return;
      setPlanCycle(p.days(), 0);
      toast(`Rhythmus „${p.name}“ läuft – heute ist Tag 1`);
      render();
    },
    custom: () => openSheet(`<h2 class="sheet-title">Eigener Rhythmus</h2>
      <p class="muted small sheet-sub">Wie viele Tage, bis es von vorn losgeht? Pausetage mitzählen – z. B. Push, Pull, Legs, Pause = 4.</p>
      <div class="len-pick">${[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button class="seg-item" data-action="len" data-n="${n}">${n}</button>`).join('')}</div>
      <p class="note">Deine vorhandenen Workouts werden der Reihe nach übernommen, der Rest sind Pausetage. Heute ist Tag 1.</p>`, {
      len: (el) => {
        const n = Number(el.dataset.n);
        const have = currentPlan().filter(Boolean);
        setPlanCycle(Array.from({ length: n }, (_, i) => have[i] || null), 0);
        closeSheet();
        toast(`Rhythmus mit ${n} Tagen – tippe auf einen Tag, um ihn zu füllen`);
        render();
      },
    }),
    shift: (el) => {
      setPlanCycle(currentPlan(), Number(el.dataset.i));
      closeSheet();
      toast(`Heute ist jetzt Tag ${Number(el.dataset.i) + 1}`);
      render();
    },
    addDay: () => {
      const days = [...currentPlan(), null];
      setPlanCycle(days, planIndex(currentVersion(), dateStr()));
      closeSheet(); render();
    },
    removeDay: async () => {
      const days = currentPlan();
      const last = days[days.length - 1];
      closeSheet();
      if (last && !(await ask(`Tag ${days.length} (${last.name}) entfernen?`, 'Das Workout dieses Tages wird aus dem Rhythmus entfernt.', 'Entfernen', true))) return;
      const t = planIndex(currentVersion(), dateStr());
      setPlanCycle(days.slice(0, -1), Math.min(t, days.length - 2));
      render();
    },
    toWeek: async () => {
      closeSheet();
      if (!(await ask('Zurück zum Wochenplan?', 'Ab heute gilt wieder ein fester Plan Mo–So. Dein letzter Wochenplan wird übernommen.', 'Wechseln'))) return;
      const lastWeek = [...data.planVersions].reverse().find((v) => !v.cycle);
      setPlanWeekly(lastWeek ? lastWeek.days : Array(7).fill(null));
      render();
    },
  });
}
