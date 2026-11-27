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
import { RANGES, overview, weekly, strength, muscleSets, records, exerciseHistory, funFacts, bestManual } from '../stats.js';
import { columnChart, lineChart, sparkline } from '../charts.js';
import { bodyHeat } from '../bodyimage.js';
import { tabBar } from './tabbar.js';
import { computeStreak } from '../streak.js';
import { ICON } from './icons.js';
import { weighRem, setWeighRem, markWeighed } from '../supps.js';
import { pushNote } from './suppui.js';
import { openPrSheet, prRows } from './prsheet.js';

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
        </div>${recordsCard(records(8))}${bodyCard()}</main>${tabBar('progress')}`;
    }

    const o = overview(range);
    const weeks = weekly(range);
    const str = strength(range);
    const tally = muscleSets(range);
    const recs = records(8);
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
      <div class="card-head"><h2>Kraft</h2><button class="chip" data-action="addPr" aria-label="Rekord eintragen">${ICON.plus} Rekord</button></div>
      <p class="muted small card-sub">geschätztes Maximum (1 Wdh)</p>
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
    const recCard = recordsCard(recs);

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
    addPr: () => openPrSheet(),
    editPr: (el) => { const pr = data.prs.find((p) => p.id === el.dataset.id); if (pr) openPrSheet({ pr }); },
    weighRem: () => openWeighRem(),
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
    const man = bestManual(exId);
    const bestTile = man && man.value > (best?.value || 0)
      ? tile('Bestwert', fmtWU(Math.round(man.value * 2) / 2, exUnit(exId)), `${fmtSet(man, ' × ', exUnit(exId))} · eingetragen`)
      : tile('Bestwert', best ? fmtWU(Math.round(best.value * 2) / 2, exUnit(exId)) : '–', best ? fmtSet(best.best, ' × ', exUnit(exId)) : '');
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

    const hist = rows.slice().reverse().map((r) => `<button class="hist-row" data-action="session" data-id="${esc(r.id)}" aria-label="Training vom ${fmtDateLong(r.date)} bearbeiten">
      <span class="hist-date">${fmtDateLong(r.date)}</span>
      <span class="hist-sets">${r.sets.map((s) => fmtSet(s, '×', u)).join(' · ')}</span><span class="chev">${ICON.chev}</span></button>`).join('');

    return `<header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">${esc(name)}</span><span class="topbar-spacer"></span>
      </header>
      <main class="content">
        <div class="tiles three">
          ${bestTile}
          ${tile('Zuletzt', last?.best ? fmtSet(last.best, ' × ', u) : '–', last ? shortDate(last.date) : '')}
          ${tile('Trainings', rows.length)}
        </div>
        <section class="card"><div class="card-head"><h2>Verlauf</h2><span class="muted small">geschätztes Maximum (1 Wdh)</span></div>${chart}</section>
        <section class="card list-card"><div class="card-head"><h2>Eingetragene Rekorde</h2><button class="chip" data-action="addPr">${ICON.plus} Eintragen</button></div>
          ${prRows(exId) || '<p class="muted small pad">Bestwerte von außerhalb der App, z. B. von früher oder einem Maximaltest.</p>'}</section>
        ${rows.length ? `<section class="card list-card"><div class="card-head"><h2>Alle Trainings</h2><span class="muted small">${u} × Wdh</span></div>${hist}</section>` : ''}
      </main>`;
  },

  after(root) {
    const svg = root.querySelector('svg.line');
    if (svg) wireLine(svg);
  },

  actions: {
    back: () => go('progress', { range: ui.params.range, more: ui.params.more }),
    session: (el) => go('session', { id: el.dataset.id, back: { screen: 'exstat', params: { ...ui.params } } }),
    addPr: () => openPrSheet({ exId: ui.params.exId }),
    editPr: (el) => { const pr = data.prs.find((p) => p.id === el.dataset.id); if (pr) openPrSheet({ pr }); },
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

const WD2 = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const remText = (r) => (r.rep?.type === 'days' ? (r.rep.days.length === 7 ? 'Täglich' : r.rep.days.slice().sort().map((d) => WD2[d]).join(', ')) : 'Täglich');

/** Erinnerung zum Wiegen: Uhrzeit, Tage, stündlich nachfragen. */
function openWeighRem() {
  const cur = weighRem();
  const st = { on: cur?.on ?? true, time: cur?.time || '07:30', days: cur?.rep?.type === 'days' ? [...cur.rep.days] : [0, 1, 2, 3, 4, 5, 6], nag: !!cur?.nag };
  const chips = () => WD2.map((d, i) => `<button class="chip sec${st.days.includes(i) ? ' on' : ''}" data-action="wd" data-i="${i}" aria-pressed="${st.days.includes(i)}">${d}</button>`).join('');
  openSheet(`<h2 class="sheet-title">Erinnerung zum Wiegen</h2>
    <p class="muted small sheet-sub">Am genauesten: morgens nach dem Klo, vor Essen und Trinken, gleiche Kleidung. Die App rechnet mit dem 7-Tage-Schnitt – je öfter du dich wiegst, desto weniger stören Schwankungen durch Wasser und Salz.</p>
    <div class="supp-form">
      <label class="gfield"><span>Uhrzeit</span><input id="wrTime" type="time" value="${st.time}" data-input="wrTime"></label>
      <h3 class="sheet-h">An diesen Tagen</h3>
      <div class="wd-chips" id="wrDays">${chips()}</div>
      <button class="switch-row" data-action="nag" role="switch" aria-checked="${st.nag}">
        <span><b>Stündlich nachfragen</b><span class="muted small">Bis du dein Gewicht eingetragen hast (höchstens bis Mitternacht).</span></span>
        <i class="switch${st.nag ? ' on' : ''}"></i>
      </button>
    </div>
    ${pushNote()}
    <div class="sheet-actions">
      <button class="btn primary big" data-action="save">${cur?.on ? 'Speichern' : 'Erinnerung einschalten'}</button>
      ${cur?.on ? '<button class="btn ghost big danger" data-action="off">Erinnerung ausschalten</button>' : ''}
    </div>`, {
    wd: (el) => { const i = +el.dataset.i; st.days = st.days.includes(i) ? st.days.filter((d) => d !== i) : [...st.days, i].sort(); document.getElementById('wrDays').innerHTML = chips(); },
    nag: (el) => { st.nag = !st.nag; el.setAttribute('aria-checked', st.nag); el.querySelector('.switch').classList.toggle('on', st.nag); },
    save: () => {
      if (!/^\d{2}:\d{2}$/.test(st.time)) return toast('Uhrzeit wählen');
      if (!st.days.length) return toast('Mindestens einen Tag wählen');
      setWeighRem({ on: true, time: st.time, rep: st.days.length === 7 ? { type: 'daily' } : { type: 'days', days: st.days }, nag: st.nag });
      // heute schon gewogen? → für heute nicht mehr erinnern
      if (data.body.some((b) => b.date === dateStr())) markWeighed();
      closeSheet(); render();
      toast(`Erinnerung zum Wiegen: ${remText(weighRem())}, ${st.time} Uhr`);
    },
    off: () => { setWeighRem({ ...weighRem(), on: false }); closeSheet(); render(); toast('Erinnerung aus'); },
    suppPush: async () => {
      const { enable } = await import('../push.js');
      try { await enable(); toast('Mitteilungen an'); if (weighRem()?.on) setWeighRem(weighRem()); } catch (e) { toast(e.message); }
      openWeighRem();
    },
    inputs: { wrTime: (el) => { st.time = el.value; } },
  });
}

/** Rekorde: neue Bestwerte aus Workouts + selbst eingetragene (antippen = ändern). */
function recordsCard(recs) {
  const rows = recs.map((r) => {
    const u = exUnit(r.exId);
    const val = `${fmtWU(r.w, u, false)} × ${fmtNum(r.r)}${r.gain ? `<small class="up"> +${fmtWU(r.gain, u)}</small>` : ''}`;
    const main = `<span class="lr-main"><span class="lr-title">${esc(r.name)}</span><span class="lr-sub">${fmtDateLong(r.date)}${r.manual ? ' · eingetragen' : ''}</span></span>`;
    return r.manual
      ? `<button class="list-row" data-action="editPr" data-id="${esc(r.id)}">${main}<span class="lr-value">${val}</span><span class="chev">${ICON.chev}</span></button>`
      : `<div class="list-row static">${main}<span class="lr-value">${val}</span></div>`;
  }).join('');
  return `<section class="card list-card rec-card"><div class="card-head"><h2>Rekorde</h2><button class="chip" data-action="addPr" aria-label="Rekord eintragen">${ICON.plus} Eintragen</button></div>
    ${rows || '<p class="muted small pad">Noch keine Rekorde. Trag deine Bestwerte ein – z. B. von vor der App – oder sie kommen automatisch beim zweiten Training einer Übung.</p>'}</section>`;
}

function bodyCard() {
  const tr = bodyTrend();
  const rem = weighRem();
  const head = `<div class="card-head"><h2>Körpergewicht</h2><span class="bw-head-btns">
    <button class="chip bell-chip${rem?.on ? ' on-rem' : ''}" data-action="weighRem" aria-label="Erinnerung zum Wiegen${rem?.on ? ` um ${rem.time} Uhr` : ' einrichten'}">${ICON.bell}${rem?.on ? ` ${rem.time}` : ''}</button>
    <button class="chip" data-action="addBw">${ICON.plus} Eintragen</button></span></div>`;
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

export function openBodySheet() {
  const today = dateStr();
  const cur = data.body.find((b) => b.date === today);
  const last = data.body[data.body.length - 1];
  openSheet(`<h2 class="sheet-title">Körpergewicht</h2>
    <p class="muted small sheet-sub">Heute, ${fmtDateLong(today)}${cur ? ' · überschreibt den heutigen Wert' : ''}</p>
    <label class="field bw-field"><input id="bwIn" inputmode="decimal" placeholder="${last ? fmtW(last.kg, false) : (wu() === 'lb' ? '165' : '75')}" value="${cur ? fmtW(cur.kg, false) : ''}" autocomplete="off" data-enter="saveBw"><span>${wu()}</span></label>
    <div class="sheet-actions">
      <button class="btn primary big" data-action="saveBw">Speichern</button>
      ${cur ? '<button class="btn ghost big danger" data-action="delBw">Heutigen Wert löschen</button>' : ''}
    </div>
    <button class="list-row set-row bw-rem-row" data-action="rem"><span class="set-ic">${ICON.bell}</span>
      <span class="lr-main"><span class="lr-title">Erinnerung zum Wiegen</span><span class="lr-sub">${weighRem()?.on ? `${remText(weighRem())} · ${weighRem().time} Uhr` : 'Aus'}</span></span><span class="chev">${ICON.chev}</span></button>`, {
    rem: () => openWeighRem(),
    saveBw: () => {
      const el = document.getElementById('bwIn');
      const v = fromW(parseNum(el.value || el.placeholder));
      if (!v || Number.isNaN(v) || v < 30 || v > 300) return toast(wu() === 'lb' ? 'Bitte ein Gewicht zwischen 66 und 660 lb eingeben' : 'Bitte ein Gewicht zwischen 30 und 300 kg eingeben');
      setBodyWeight(today, Math.round(v * 100) / 100);
      markWeighed(today); // Erinnerung für heute erledigt
      closeSheet();
      render();
    },
    delBw: () => { setBodyWeight(today, null); closeSheet(); render(); },
  });
  setTimeout(() => document.getElementById('bwIn')?.focus(), 350);
}
