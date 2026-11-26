// =============================================================
// progress.js – Tab "Fortschritt" + Detailansicht einer Übung
//
// Abschnitte (von "Wie läuft's?" zu Details):
//   1. Kennzahlen      – Trainings, Serie, Volumen, Ø Dauer (+ Vergleich)
//   2. Trainings/Woche – erledigt vs. geplant
//   3. Kraft           – geschätztes 1RM je Übung, antippen = Details
//   4. Muskelbalance   – Körperbild + Sätze je Muskelgruppe
//   5. Körpergewicht   – Verlauf, Trend pro Woche, Einordnung
//   6. Rekorde         – neue Bestwerte
// =============================================================

import { go, render, ui, openSheet, closeSheet, toast } from '../app.js';
import { data, setBodyWeight, exUnit } from '../store.js';
import { esc, fmtNum, fmtBig, fmtDurationLong, fmtDateLong, parseDate, WEEKDAYS, dateStr, parseNum, fmtSet, fmtW, fmtWU, toU, toW, fromW, wu, fmtVol } from '../util.js';
import { bodyTrend } from '../coach.js';
import { MUSCLES, getExercise } from '../exercises.js';
import { RANGES, overview, weekly, strength, muscleSets, records, exerciseHistory, funFacts } from '../stats.js';
import { columnChart, lineChart, sparkline } from '../charts.js';
import { bodyHeat } from '../bodyimage.js';
import { tabBar } from './tabbar.js';
import { computeStreak } from '../streak.js';
import { ICON } from './icons.js';

const kgOrT = (kg) => fmtVol(kg);
const shortDate = (ds) => { const d = parseDate(ds); return `${d.getDate()}.${d.getMonth() + 1}.`; };

/** Veränderung als kleine Zeile mit Pfeil (Text in Textfarbe, nicht Datenfarbe). */
function delta(cur, prev, fmt = (v) => v) {
  if (!prev && !cur) return '';
  if (!prev) return '<span class="delta">neu</span>';
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return '<span class="delta">wie vorher</span>';
  const up = pct > 0;
  return `<span class="delta ${up ? 'up' : 'down'}">${up ? ICON.arrowUp : ICON.arrowDown}${up ? '+' : ''}${pct} % <span class="muted">vs. davor</span></span>`;
}

function tile(label, value, sub = '') {
  return `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value">${value}</span>${sub ? `<span class="tile-sub">${sub}</span>` : ''}</div>`;
}

export const progressScreen = {
  render(params) {
    const range = params.range || '4w';
    const seg = `<div class="seg-wrap" role="tablist" aria-label="Zeitraum">${Object.entries(RANGES)
      .map(([k, r]) => `<button class="seg-item${k === range ? ' on' : ''}" role="tab" aria-selected="${k === range}" data-action="range" data-range="${k}">${r.label}</button>`)
      .join('')}</div>`;

    const head = '';
    if (!data.sessions.length) {
      return `${head}<main class="content no-title has-tabbar"><div class="empty card">
          <div class="empty-icon">${ICON.chart}</div>
          <h2>Noch keine Daten</h2>
          <p class="muted">Sobald du dein erstes Workout speicherst, siehst du hier Trainings pro Woche, deine Kraftentwicklung, Muskelbalance und Rekorde.</p>
        </div>${bodyCard()}</main>${tabBar('progress')}`;
    }

    const o = overview(range);
    const weeks = weekly(range);
    const str = strength(range);
    const tally = muscleSets(range);
    const recs = records(5);
    const ds = computeStreak();

    // 1. Kennzahlen
    const tiles = `<div class="tiles">
      ${tile('Trainings', o.cur.count, o.planned ? `${Math.round(o.adherence * 100)} % vom Plan` : '')}
      ${tile('Streak', `${ds.current} ${ds.current === 1 ? 'Tag' : 'Tage'}`, `Rekord: ${ds.best} ${ds.best === 1 ? 'Tag' : 'Tage'}`)}
      ${tile('Volumen', kgOrT(o.cur.volume), delta(o.cur.volume, o.prev.volume))}
      ${tile('Ø Dauer', o.cur.count ? fmtDurationLong(o.cur.avgDuration) : '–', `${o.cur.sets} Sätze gesamt`)}
    </div>`;

    // 2. Trainings pro Woche
    const items = weeks.map((w) => ({
      label: shortDate(w.from), done: w.done, planned: w.planned,
      tip: `Woche ab ${fmtDateLong(w.from)}: ${w.done} von ${w.planned} geplanten Trainings${w.volume ? `, ${kgOrT(w.volume)} Volumen` : ''}`,
    }));
    const weekCard = `<section class="card">
      <div class="card-head"><h2>Trainings pro Woche</h2>
        <span class="legend-inline"><i class="sw sw-done"></i>Erledigt <i class="sw sw-plan"></i>Geplant</span></div>
      ${columnChart(items)}
      <p class="chart-tip" id="weekTip">${esc(items[items.length - 1].tip)}</p>
    </section>`;

    // 3. Kraft
    const strengthRows = str.slice(0, 8).map((e) => {
      const ch = e.change, u = exUnit(e.exId);
      const chTxt = Math.abs(ch) < 0.25 ? 'unverändert' : `${ch > 0 ? '+' : '−'}${fmtWU(Math.abs(ch), u)}`;
      return `<button class="list-row" data-action="exercise" data-id="${esc(e.exId)}">
        <span class="lr-main"><span class="lr-title">${esc(e.name)}</span><span class="lr-sub">${e.inRange.length}× trainiert · ${chTxt}</span></span>
        ${sparkline(e.inRange.map((p) => toU(p.value, u)))}
        <span class="lr-value">${fmtWU(e.last, u, false)}<small> ${u}</small></span>
        <span class="chev">${ICON.chev}</span></button>`;
    }).join('');
    const strengthCard = `<section class="card list-card">
      <div class="card-head"><h2>Kraft</h2><span class="muted small">geschätztes Maximum (1 Wdh)</span></div>
      ${strengthRows || '<p class="muted small pad">Noch keine Sätze mit Gewicht in diesem Zeitraum.</p>'}
    </section>`;

    // 4. Muskelbalance
    const entries = Object.keys(MUSCLES).map((k) => [k, tally[k] || 0]).sort((a, b) => b[1] - a[1]);
    const max = entries[0][1] || 1;
    const low = entries.filter(([, v]) => v < max * 0.15).map(([k]) => MUSCLES[k]);
    const bars = entries.filter(([, v]) => v > 0).slice(0, 8).map(([k, v]) =>
      `<div class="hbar"><span class="hbar-label">${MUSCLES[k]}</span><span class="hbar-track"><i style="width:${(v / max) * 100}%"></i></span><span class="hbar-val">${fmtNum(Math.round(v * 2) / 2)}</span></div>`).join('');
    const balanceCard = `<section class="card">
      <div class="card-head"><h2>Muskelbalance</h2><span class="muted small">Sätze, Hilfsmuskeln zählen halb</span></div>
      ${bodyHeat(tally)}
      <div class="heat-legend"><span>wenig</span><i></i><span>viel</span></div>
      <div class="hbars">${bars}</div>
      ${low.length && low.length < 18 ? `<p class="note">Kaum trainiert: ${low.slice(0, 5).join(', ')}${low.length > 5 ? ' …' : ''}</p>` : ''}
    </section>`;

    // 5. Rekorde
    const recRows = recs.map((r) => `<div class="list-row static">
      <span class="lr-main"><span class="lr-title">${esc(r.name)}</span><span class="lr-sub">${fmtDateLong(r.date)}</span></span>
      <span class="lr-value">${fmtWU(r.w, exUnit(r.exId), false)} × ${fmtNum(r.r)}<small class="up"> +${fmtWU(r.gain, exUnit(r.exId))}</small></span></div>`).join('');
    const recCard = `<section class="card list-card"><div class="card-head"><h2>Rekorde</h2><span class="muted small">neue Bestwerte</span></div>
      ${recRows || '<p class="muted small pad">Noch keine Rekorde – die kommen beim zweiten Training einer Übung.</p>'}</section>`;

    // "Gut zu wissen": eher zum Staunen als zum Steuern
    const f = funFacts();
    const compare = f.volume >= 150000 ? `so viel wie ${fmtNum(Math.round(f.volume / 150000 * 10) / 10)} Blauwale`
      : f.volume >= 6000 ? `so viel wie ${fmtNum(Math.round(f.volume / 6000 * 10) / 10)} Elefanten`
      : `so viel wie ${fmtNum(Math.round(f.volume / 1500 * 10) / 10)} Autos`;
    const funCard = `<section class="card"><div class="card-head"><h2>Gut zu wissen</h2><span class="muted small">seit ${fmtDateLong(f.since)}</span></div>
      <div class="fact-hero"><span class="fact-big">${kgOrT(f.volume)}</span><span class="muted small">insgesamt bewegt – ${compare}</span></div>
      <div class="facts">
        ${tile('Workouts', f.count, `${fmtNum(Math.round(f.hours))} Stunden im Gym`)}
        ${tile('Wiederholungen', fmtBig(f.reps), 'insgesamt')}
        ${tile('Lieblingsübung', f.favorite ? esc(f.favorite.name) : '–', f.favorite ? `${f.favorite.sets} Sätze` : '')}
        ${tile('Stärkste Übung', f.strongest ? esc(f.strongest.name) : '–', f.strongest ? `${fmtW(f.strongest.w)} × ${fmtNum(f.strongest.r)}` : '')}
        ${tile('Längste Serie', `${f.longestStreak} ${f.longestStreak === 1 ? 'Woche' : 'Wochen'}`, 'Plan in Folge erfüllt')}
        ${tile('Lieblingstag', WEEKDAYS[f.topWeekday], `meist gegen ${f.avgStart} Uhr`)}
      </div></section>`;

    // Wichtiges oben, Zusätzliches aufklappbar darunter
    const open = !!params.more;
    const more = `<button class="more-toggle${open ? ' open' : ''}" data-action="more" aria-expanded="${open}" aria-controls="moreBox">
        <span>${open ? 'Weniger' : 'Mehr'}</span>${ICON.chevDown}</button>
      <div class="more-box${open ? ' open' : ''}" id="moreBox"><div class="more-inner">${balanceCard}${recCard}${funCard}</div></div>`;

    return `${head}<main class="content no-title has-tabbar progress-tab">
      <div class="filter-row">${seg}</div>
      ${tiles}${weekCard}${strengthCard}${bodyCard()}${more}
    </main>${tabBar('progress')}`;
  },

  after(root) {
    root.querySelectorAll('svg.line').forEach(wireLine);
  },

  actions: {
    range: (el) => { ui.params.range = el.dataset.range; render(); },
    addBw: () => openBodySheet(),
    tip: (el) => {
      document.querySelectorAll('.chart .hit.sel').forEach((h) => h.classList.remove('sel'));
      el.classList.add('sel');
      el.closest('svg').classList.add('has-sel');
      document.getElementById('weekTip').textContent = el.dataset.tip;
    },
    exercise: (el) => go('exstat', { exId: el.dataset.id, range: ui.params.range, more: ui.params.more }),
    // Aufklappen ohne Neu-Rendern, damit die Höhe weich animiert
    more: (el) => {
      ui.params.more = !ui.params.more;
      el.classList.toggle('open', ui.params.more);
      el.setAttribute('aria-expanded', ui.params.more);
      el.querySelector('span').textContent = ui.params.more ? 'Weniger' : 'Mehr';
      document.getElementById('moreBox').classList.toggle('open', ui.params.more);
    },
  },
};

// ---------- Detailansicht einer Übung ----------

export const exstatScreen = {
  render({ exId }) {
    const ex = getExercise(exId);
    const rows = exerciseHistory(exId);
    const name = ex?.name || rows[0]?.name || 'Übung';
    const valid = rows.filter((r) => r.value > 0);
    const best = valid.reduce((a, b) => (b.value > (a?.value || 0) ? b : a), null);
    const last = rows[rows.length - 1];
    const u = exUnit(exId);
    const fmtW = (kg) => fmtWU(kg, u);

    let chart = '<p class="muted small pad">Für einen Verlauf braucht es mindestens zwei Trainings mit Gewicht.</p>';
    if (valid.length >= 2) {
      const t0 = parseDate(valid[0].date).getTime(), t1 = parseDate(valid[valid.length - 1].date).getTime();
      const pts = valid.map((r) => ({
        x: t1 > t0 ? (parseDate(r.date).getTime() - t0) / (t1 - t0) : 0.5,
        v: toU(r.value, u),
        tip: `${fmtDateLong(r.date)} · ${fmtW(r.value)} (${fmtSet(r.best, ' × ', u)})`,
      }));
      chart = lineChart(pts) + `<div class="axis-dates"><span>${shortDate(valid[0].date)}</span><span>${shortDate(valid[valid.length - 1].date)}</span></div>`;
    }

    const hist = rows.slice().reverse().map((r) => `<div class="hist-row">
      <span class="hist-date">${fmtDateLong(r.date)}</span>
      <span class="hist-sets">${r.sets.map((s) => fmtSet(s, '×', u)).join(' · ')}</span></div>`).join('');

    return `<header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">${esc(name)}</span><span class="topbar-spacer"></span>
      </header>
      <main class="content">
        <div class="tiles three">
          ${tile('Bestwert', best ? fmtW(best.value) : '–', best ? fmtSet(best.best, ' × ', u) : '')}
          ${tile('Zuletzt', last?.best ? fmtSet(last.best, ' × ', u) : '–', last ? shortDate(last.date) : '')}
          ${tile('Trainings', rows.length)}
        </div>
        <section class="card"><div class="card-head"><h2>Verlauf</h2><span class="muted small">geschätztes Maximum (1 Wdh)</span></div>${chart}</section>
        <section class="card list-card"><div class="card-head"><h2>Alle Trainings</h2><span class="muted small">${u} × Wdh</span></div>${hist}</section>
      </main>`;
  },

  after(root) {
    const svg = root.querySelector('svg.line');
    if (svg) wireLine(svg);
  },

  actions: {
    back: () => go('progress', { range: ui.params.range, more: ui.params.more }),
  },
};

/** Fadenkreuz: Finger über das Liniendiagramm → nächster Punkt + Tooltip. */
function wireLine(svg) {
  const pts = JSON.parse(svg.dataset.points);
  const W = +svg.dataset.w;
  const xh = svg.querySelector('.xhair'), dot = svg.querySelector('.xdot');
  const tip = svg.parentElement.querySelector('.tip');
  const show = (clientX) => {
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const p = pts.reduce((a, b) => (Math.abs(b.cx - x) < Math.abs(a.cx - x) ? b : a));
    xh.setAttribute('x1', p.cx); xh.setAttribute('x2', p.cx); xh.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', p.cx); dot.setAttribute('cy', p.cy); dot.setAttribute('visibility', 'visible');
    tip.textContent = p.tip;
    tip.hidden = false;
    const left = (p.cx / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 90), r.width - 90)}px`;
  };
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  show(svg.getBoundingClientRect().right); // letzter Punkt vorausgewählt
}

// ---------- Körpergewicht ----------

function bodyCard() {
  const tr = bodyTrend();
  const head = `<div class="card-head"><h2>Körpergewicht</h2><button class="chip" data-action="addBw">${ICON.plus} Eintragen</button></div>`;
  if (!tr) {
    return `<section class="card body-card">${head}
      <p class="muted small">Wiege dich morgens nach dem Aufstehen, 3–7× pro Woche. Entscheidend ist der Wochenschnitt, nicht der einzelne Wert – er zeigt, ob du im richtigen Tempo für Muskelaufbau zunimmst.</p></section>`;
  }
  const recent = data.body.filter((b) => b.date >= dateStr(new Date(Date.now() - 120 * 864e5)));
  let chart = '';
  if (recent.length >= 2) {
    const t0 = parseDate(recent[0].date).getTime(), t1 = parseDate(recent[recent.length - 1].date).getTime();
    chart = lineChart(recent.map((b) => ({ x: t1 > t0 ? (parseDate(b.date).getTime() - t0) / (t1 - t0) : 0.5, v: toW(b.kg), tip: `${fmtDateLong(b.date)} · ${fmtW(b.kg)}` })), { height: 150 })
      + `<div class="axis-dates"><span>${shortDate(recent[0].date)}</span><span>${shortDate(recent[recent.length - 1].date)}</span></div>`;
  }
  const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
  const pw = tr.perWeek == null ? '–' : `${sign(tr.perWeek)}${fmtNum(Math.round(toW(Math.abs(tr.perWeek)) * 100) / 100)} ${wu()}`;
  const pct = tr.pct == null ? 'Trend ab 10 Tagen' : `${sign(tr.pct)}${fmtNum(Math.round(Math.abs(tr.pct) * 100) / 100)} % pro Woche`;
  return `<section class="card body-card">${head}
    <div class="tiles flat">
      ${tile('Ø 7 Tage', fmtW(tr.current), `zuletzt ${fmtW(tr.last.kg)} · ${shortDate(tr.last.date)}`)}
      ${tile('Pro Woche', pw, pct)}
    </div>
    ${chart}
    <p class="verdict ${tr.tone}">${esc(tr.verdict)}</p></section>`;
}

function openBodySheet() {
  const today = dateStr();
  const cur = data.body.find((b) => b.date === today);
  const last = data.body[data.body.length - 1];
  openSheet(`<h2 class="sheet-title">Körpergewicht</h2>
    <p class="muted small sheet-sub">Heute, ${fmtDateLong(today)}${cur ? ' · überschreibt den heutigen Wert' : ''}</p>
    <label class="field bw-field"><input id="bwIn" inputmode="decimal" placeholder="${last ? fmtW(last.kg, false) : (wu() === 'lb' ? '165' : '75')}" value="${cur ? fmtW(cur.kg, false) : ''}" autocomplete="off" data-enter="saveBw"><span>${wu()}</span></label>
    <div class="sheet-actions">
      <button class="btn primary big" data-action="saveBw">Speichern</button>
      ${cur ? '<button class="btn ghost big danger" data-action="delBw">Heutigen Wert löschen</button>' : ''}
    </div>`, {
    saveBw: () => {
      const el = document.getElementById('bwIn');
      const v = fromW(parseNum(el.value || el.placeholder));
      if (!v || Number.isNaN(v) || v < 30 || v > 300) return toast(wu() === 'lb' ? 'Bitte ein Gewicht zwischen 66 und 660 lb eingeben' : 'Bitte ein Gewicht zwischen 30 und 300 kg eingeben');
      setBodyWeight(today, Math.round(v * 100) / 100);
      closeSheet();
      render();
    },
    delBw: () => { setBodyWeight(today, null); closeSheet(); render(); },
  });
  setTimeout(() => document.getElementById('bwIn')?.focus(), 350);
}
