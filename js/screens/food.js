// =============================================================
// food.js (Screen) – Tab "Ernährung": Kalorien & Protein pro Tag
//
// Oben: was heute noch fehlt (kcal + Protein). Darunter Einträge des Tages,
// Ziel mit Anpassungs-Vorschlag aus dem Gewichtsverlauf, 7-Tage-Verlauf.
// Eintragen: Suche (eingebaute Liste, zuletzt gegessen, Open Food Facts),
// Menge wählen, fertig. Android: Barcode scannen (BarcodeDetector).
// =============================================================

import { render, ui, openSheet, closeSheet, toast, ask } from '../app.js';
import { esc, fmtNum, fmtBig, dateStr, parseDate, addDays, fmtDateLong, parseNum, WD_SHORT, weekdayIdx } from '../util.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';
import { columnChart } from '../charts.js';
import {
  ACTIVITY, GOALS, profile, targets, adjustHint, saveProfile, weightNow, logFood, logQuick, removeFood,
  entriesOf, sumOf, lastDays, searchLocal, searchOnline, byBarcode,
} from '../nutrition.js';

const bar = (val, max, cls = '') => `<div class="nbar ${cls}${val > max * 1.05 ? ' over' : ''}"><i style="width:${Math.min(100, max ? (val / max) * 100 : 0)}%"></i></div>`;

export const foodScreen = {
  render(params) {
    const t = targets();
    if (!t) return `<main class="content no-title has-tabbar food">${setupIntro()}</main>${tabBar('food')}`;
    const today = dateStr();
    const ds = params.date || today;
    const list = entriesOf(ds).slice().sort((a, b) => a.t - b.t);
    const sum = sumOf(list);
    const left = t.kcal - sum.kcal;
    const dayName = ds === today ? 'Heute' : ds === dateStr(addDays(new Date(), -1)) ? 'Gestern' : fmtDateLong(ds);

    const rows = list.map((x) => `<div class="list-row static food-row">
        <span class="lr-main"><span class="lr-title">${esc(x.name)}</span>
          <span class="lr-sub">${x.g ? `${fmtBig(x.g)} g · ` : ''}${fmtNum(Math.round(x.p))} g Protein · ${new Date(x.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></span>
        <span class="lr-value">${fmtBig(x.kcal)}<small> kcal</small></span>
        <button class="icon-btn sm" data-action="del" data-id="${esc(x.id)}" aria-label="Löschen">${ICON.x}</button></div>`).join('');

    const hint = adjustHint();
    const n = profile();
    const week = lastDays(7);
    const chart = columnChart(week.days.map((d) => ({
      label: WD_SHORT[weekdayIdx(parseDate(d.ds))], done: d.kcal, planned: t.kcal,
      tip: `${fmtDateLong(d.ds)}: ${d.has ? `${fmtBig(d.kcal)} kcal, ${Math.round(d.p)} g Protein` : 'nichts eingetragen'}`,
    })), { height: 140 });

    return `<main class="content no-title has-tabbar food">
      <div class="day-switch">
        <button class="icon-btn sm" data-action="prevDay" aria-label="Vorheriger Tag">${ICON.chevL}</button>
        <b>${dayName}</b>
        <button class="icon-btn sm" data-action="nextDay" ${ds >= today ? 'disabled' : ''} aria-label="Nächster Tag">${ICON.chevR}</button>
      </div>

      <section class="card kcal-card">
        <div class="kcal-top">
          <div><span class="kcal-big">${fmtBig(Math.abs(left))}</span><span class="kcal-unit"> kcal ${left >= 0 ? 'übrig' : 'drüber'}</span></div>
          <span class="muted small">${fmtBig(sum.kcal)} / ${fmtBig(t.kcal)}</span>
        </div>
        ${bar(sum.kcal, t.kcal)}
        <div class="macro">
          <div><span>Protein</span><b>${Math.round(sum.p)} / ${t.p} g</b>${bar(sum.p, t.p, 'p')}</div>
          <div><span>Kohlenhydr.</span><b>${Math.round(sum.c)} / ${t.c} g</b>${bar(sum.c, t.c, 'c')}</div>
          <div><span>Fett</span><b>${Math.round(sum.f)} / ${t.f} g</b>${bar(sum.f, t.f, 'f')}</div>
        </div>
        <button class="btn primary big full" data-action="add">${ICON.plus} Essen eintragen</button>
      </section>

      ${list.length ? `<section class="card list-card"><div class="card-head"><h2>${dayName === 'Heute' ? 'Heute gegessen' : 'Gegessen'}</h2><span class="muted small">${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}</span></div>${rows}</section>` : ''}

      <section class="card">
        <div class="card-head"><h2>Ziel: ${GOALS[n.goal || 'bulk'][0]}</h2><button class="chip" data-action="goal">Anpassen</button></div>
        <p class="muted small">${fmtBig(t.kcal)} kcal · ${t.p} g Protein · Gesamtbedarf ca. ${fmtBig(t.tdee)} kcal (${fmtNum(Math.round(weightNow() * 10) / 10)} kg)${n.kcal ? ' · feste Vorgabe' : ''}</p>
        ${hint ? `<div class="hint-box"><p>${esc(hint.text)}</p><button class="chip" data-action="applyHint" data-d="${hint.delta}">Übernehmen</button></div>` : ''}
      </section>

      <section class="card">
        <div class="card-head"><h2>Letzte 7 Tage</h2><span class="muted small">${week.avg ? `Ø ${fmtBig(week.avg.kcal)} kcal · ${week.avg.p} g Protein` : 'noch keine Einträge'}</span></div>
        ${chart}
        <p class="chart-tip" id="weekTip">Balken antippen für Details. Heller Balken = Ziel.</p>
      </section>
    </main>${tabBar('food')}`;
  },

  actions: {
    setup: () => openGoalSheet(),
    goal: () => openGoalSheet(),
    add: () => openAddSheet(),
    del: async (el) => { removeFood(el.dataset.id); render(); },
    prevDay: () => { ui.params.date = dateStr(addDays(parseDate(ui.params.date || dateStr()), -1)); render(); },
    nextDay: () => { const n = dateStr(addDays(parseDate(ui.params.date || dateStr()), 1)); ui.params.date = n >= dateStr() ? null : n; render(); },
    applyHint: (el) => { saveProfile({ adjust: (profile().adjust || 0) + Number(el.dataset.d), kcal: null }); toast('Ziel angepasst'); render(); },
    tip: (el) => {
      document.querySelectorAll('.chart .hit.sel').forEach((h) => h.classList.remove('sel'));
      el.classList.add('sel');
      el.closest('svg').classList.add('has-sel');
      document.getElementById('weekTip').textContent = el.dataset.tip;
    },
  },
};

function setupIntro() {
  return `<section class="card empty">
    <div class="empty-icon">${ICON.food}</div>
    <h2>Kalorien & Protein</h2>
    <p class="muted">Gib einmal Größe, Alter und Aktivität an. Die App berechnet daraus dein Tagesziel für Aufbau, Halten oder Diät – und passt es später an deinen Gewichtsverlauf an.</p>
    <button class="btn primary big full" data-action="setup">Ziel einrichten</button>
  </section>`;
}

// ---------- Ziel einrichten ----------

function openGoalSheet() {
  const n = profile();
  const w = weightNow();
  const seg = (name, opts, cur) => `<div class="seg-wrap seg-full" role="group">${opts.map(([v, l]) => `<button class="seg-item${String(cur) === String(v) ? ' on' : ''}" data-action="pickSeg" data-name="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const state = { sex: n.sex || 'm', goal: n.goal || 'bulk', activity: n.activity || 1.55 };
  openSheet(`<h2 class="sheet-title">Dein Ziel</h2>
    <h3 class="sheet-h">Ziel</h3>${seg('goal', Object.entries(GOALS).map(([k, g]) => [k, g[0]]), state.goal)}
    <h3 class="sheet-h">Geschlecht</h3>${seg('sex', [['m', 'Männlich'], ['f', 'Weiblich']], state.sex)}
    <div class="goal-fields">
      <label class="field"><input id="gAge" inputmode="numeric" value="${n.age || ''}" placeholder="18"><span>Jahre</span></label>
      <label class="field"><input id="gHeight" inputmode="numeric" value="${n.height || ''}" placeholder="180"><span>cm</span></label>
      <label class="field"><input id="gWeight" inputmode="decimal" value="${w ? fmtNum(Math.round(w * 10) / 10) : ''}" placeholder="75"><span>kg</span></label>
    </div>
    <h3 class="sheet-h">Aktivität</h3>
    <div class="drinks">${ACTIVITY.map(([f, l, d]) => `<button class="drink act${state.activity === f ? ' on' : ''}" data-action="pickSeg" data-name="activity" data-v="${f}"><span><span class="drink-name">${l}</span><br><span class="muted small">${d}</span></span><span class="copy-check">${ICON.check}</span></button>`).join('')}</div>
    <h3 class="sheet-h">Feste Kalorien (optional)</h3>
    <label class="field"><input id="gKcal" inputmode="numeric" value="${n.kcal || ''}" placeholder="automatisch"><span>kcal</span></label>
    <div class="sheet-actions" style="margin-top:16px"><button class="btn primary big" data-action="saveGoal">Speichern</button></div>
    <p class="source">Formel: Mifflin-St Jeor × Aktivität. Aufbau +10 %, Diät −20 %. Protein 1,8 g/kg (Diät 2,2 g/kg) nach Morton et al. 2018. Das Gewicht kommt aus deinem Gewichtsverlauf (Fortschritt), wenn vorhanden.</p>`, {
    pickSeg: (el) => {
      const name = el.dataset.name;
      state[name] = name === 'activity' ? Number(el.dataset.v) : el.dataset.v;
      el.parentElement.querySelectorAll(`[data-name="${name}"]`).forEach((b) => b.classList.toggle('on', b === el));
    },
    saveGoal: () => {
      const age = parseNum(document.getElementById('gAge').value);
      const height = parseNum(document.getElementById('gHeight').value);
      const weight = parseNum(document.getElementById('gWeight').value);
      const kcal = parseNum(document.getElementById('gKcal').value);
      if (!age || !height || !weight || [age, height, weight].some(Number.isNaN) || age < 12 || age > 100 || height < 120 || height > 230 || weight < 30 || weight > 300) {
        return toast('Bitte Alter, Größe und Gewicht prüfen');
      }
      saveProfile({ ...state, age: Math.round(age), height: Math.round(height), weight: Math.round(weight * 10) / 10, kcal: kcal && !Number.isNaN(kcal) ? Math.round(kcal) : null, adjust: 0 });
      closeSheet();
      toast('Ziel gespeichert');
      render();
    },
  });
}

// ---------- Essen eintragen ----------

function openAddSheet() {
  let results = searchLocal('');
  let online = [];
  let timer, ctrl;
  const list = () => {
    const all = [...results, ...online];
    const item = (f, i) => `<button class="drink" data-action="pick" data-i="${i}"><span class="drink-name">${esc(f.name)}</span>
      <span class="drink-meta"><b>${f.kcal}</b> kcal · ${fmtNum(f.p)} g P <small>/100 g</small></span></button>`;
    return (results.length ? results.map((f, i) => item(f, i)).join('') : '')
      + (online.length ? `<div class="drinks-sep">Online (Open Food Facts)</div>${online.map((f, i) => item(f, results.length + i)).join('')}` : '')
      || '<p class="muted small pad">Nichts gefunden – oben „Schnell eintragen“ nutzen.</p>';
  };
  const redraw = () => { const el = document.getElementById('foodRes'); if (el) el.innerHTML = list(); };
  openSheet(`<h2 class="sheet-title">Essen eintragen</h2>
    <div class="add-row">
      <input id="foodQ" class="input" placeholder="Suchen, z. B. Skyr, Haferflocken" autocomplete="off" data-input="q" enterkeyhint="search">
      ${'BarcodeDetector' in window ? `<button class="btn" data-action="scan" aria-label="Barcode scannen">${ICON.barcode}</button>` : ''}
    </div>
    <p class="muted small" id="onlineState" style="margin:6px 2px 0"></p>
    <div class="drinks food-res" id="foodRes">${list()}</div>
    <h3 class="sheet-h">Schnell eintragen</h3>
    <div class="add-row">
      <input id="qKcal" class="input mg-input" inputmode="numeric" placeholder="kcal">
      <input id="qP" class="input mg-input" inputmode="decimal" placeholder="Protein g">
      <button class="btn" data-action="quick">+</button>
    </div>`, {
    inputs: {
      q: (el) => {
        const q = el.value;
        results = searchLocal(q);
        online = [];
        redraw();
        clearTimeout(timer);
        ctrl?.abort();
        const st = document.getElementById('onlineState');
        if (q.trim().length < 3) { st.textContent = ''; return; }
        st.textContent = 'Suche auch online …';
        timer = setTimeout(async () => {
          ctrl = new AbortController();
          try {
            online = (await searchOnline(q.trim(), ctrl.signal)).filter((f) => !results.some((r) => r.name === f.name));
            st.textContent = online.length ? '' : 'Online nichts gefunden.';
            redraw();
          } catch (e) {
            if (e.name !== 'AbortError') st.textContent = 'Online-Suche gerade nicht erreichbar.';
          }
        }, 450);
      },
    },
    pick: (el) => openAmountSheet([...results, ...online][Number(el.dataset.i)]),
    quick: () => {
      const kcal = parseNum(document.getElementById('qKcal').value);
      const p = parseNum(document.getElementById('qP').value) || 0;
      if (!kcal || Number.isNaN(kcal)) return toast('Kalorien eingeben');
      logQuick('Schnell eingetragen', kcal, Number.isNaN(p) ? 0 : p);
      closeSheet(); toast(`${Math.round(kcal)} kcal eingetragen`); render();
    },
    scan: () => scanBarcode(),
  });
  setTimeout(() => document.getElementById('foodQ')?.focus(), 350);
}

function openAmountSheet(food) {
  if (!food) return;
  const start = food.lastG || food.portion || 100;
  const calc = (g) => `<b>${fmtBig(food.kcal * g / 100)}</b> kcal · ${fmtNum(Math.round(food.p * g / 10) / 10)} g Protein · ${fmtNum(Math.round(food.c * g / 10) / 10)} g KH · ${fmtNum(Math.round(food.f * g / 10) / 10)} g Fett`;
  const chips = [[food.portion, `1 ${food.unit || 'Portion'}`], [food.portion * 2, `2 ${food.unit || 'Portionen'}`], [100, '100 g']]
    .filter(([g], i, a) => g && a.findIndex(([x]) => x === g) === i);
  openSheet(`<h2 class="sheet-title">${esc(food.name)}</h2>
    <p class="muted small sheet-sub">Je 100 g: ${food.kcal} kcal · ${fmtNum(food.p)} g Protein</p>
    <label class="field amount"><input id="aG" inputmode="decimal" value="${start}" data-input="g" data-enter="log"><span>g</span></label>
    <div class="chips amount-chips">${chips.map(([g, l]) => `<button class="chip" data-action="setG" data-g="${g}">${l}</button>`).join('')}</div>
    <p class="amount-calc" id="aCalc">${calc(start)}</p>
    <div class="sheet-actions"><button class="btn primary big" data-action="log">Eintragen</button></div>`, {
    inputs: { g: (el) => { const g = parseNum(el.value); if (g && !Number.isNaN(g)) document.getElementById('aCalc').innerHTML = calc(g); } },
    setG: (el) => { const i = document.getElementById('aG'); i.value = el.dataset.g; document.getElementById('aCalc').innerHTML = calc(+el.dataset.g); },
    log: () => {
      const g = parseNum(document.getElementById('aG').value);
      if (!g || Number.isNaN(g) || g > 5000) return toast('Menge in Gramm eingeben');
      const e = logFood(food, g);
      closeSheet();
      toast(`${food.name}: ${e.kcal} kcal eingetragen`);
      ui.params.date = null;
      render();
    },
  });
}

// ---------- Barcode (Android/Chrome: BarcodeDetector) ----------

async function scanBarcode() {
  closeSheet(true);
  const ov = document.createElement('div');
  ov.className = 'scan';
  ov.innerHTML = `<video playsinline muted></video><div class="scan-frame"></div>
    <p class="scan-text">Barcode in den Rahmen halten</p><button class="glass-circle scan-x" aria-label="Schließen">${ICON.x}</button>`;
  document.body.appendChild(ov);
  let stream, stop = false;
  const end = () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); ov.remove(); };
  ov.querySelector('.scan-x').onclick = () => { end(); openAddSheet(); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = ov.querySelector('video');
    v.srcObject = stream;
    await v.play();
    const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    while (!stop) {
      const codes = await det.detect(v).catch(() => []);
      if (codes.length) {
        const code = codes[0].rawValue;
        end();
        toast('Suche Produkt …');
        const food = await byBarcode(code).catch(() => null);
        if (food) openAmountSheet(food);
        else { toast(`Produkt ${code} nicht gefunden – bitte suchen`); openAddSheet(); }
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch {
    end();
    toast('Kamera nicht verfügbar');
    openAddSheet();
  }
}
