// =============================================================
// food.js (Screen) – Tab "Ernährung"
//
// Oben: was heute noch fehlt (kcal + Makros). Darunter zwei Ringe:
// Ernährungsqualität (0–100, antippen = Aufschlüsselung) und Wasser.
// Dann Einträge, Ziel (mit Zielgewicht/Datum, gemessenem Bedarf und
// Warnungen) und 7-Tage-Verlauf. Eintragen: Suche (eingebaute Liste,
// zuletzt gegessen, Open Food Facts), Menge wählen; Schnelleintrag mit
// kcal/Protein/KH/Fett; Barcode scannen (Android eingebaut, iPhone über ZXing).
// Eigene Lebensmittel: selbst angelegt = nur für dich; mit Barcode = für alle.
// =============================================================

import { render, ui, openSheet, closeSheet, toast, go } from '../app.js';
import { esc, fmtNum, fmtBig, dateStr, parseDate, addDays, fmtDateLong, parseNum, WD_SHORT, weekdayIdx, fmtW, fromW, toW, wu } from '../util.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';
import { columnChart } from '../charts.js';
import {
  JOBS, SPORTS, LEVELS, GOALS, profile, targets, adjustHint, saveProfile, weightNow, logFood, logQuick, removeFood,
  updateFood, entriesOf, sumOf, lastDays, searchLocal, searchOnline, byBarcode, healthScore, waterOf, waterTarget, logWater, undoWater, fmtL,
  meals, mealAsFood, mealTotals, saveMeal, deleteMeal, loadFoodDb, foodDbReady, DB_SOURCE,
  myFoods, saveMyFood, deleteMyFood, checkFood, communityAdd,
} from '../nutrition.js';
import { ask } from '../app.js';
import { suppCard, suppActions } from './suppui.js';
import { scanCode, canScan, makeDetector } from '../scanner.js';
export { makeDetector };

const bar = (val, max, cls = '') => `<div class="nbar ${cls}${val > max * 1.05 ? ' over' : ''}"><i style="width:${Math.min(100, max ? (val / max) * 100 : 0)}%"></i></div>`;

/** Ring (SVG): Anteil k (0..1), Farbe, Text in der Mitte. */
function ring(k, color, big, small, size = 104) {
  const r = 44, len = 2 * Math.PI * r;
  return `<svg class="ring2" viewBox="0 0 104 104" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="52" cy="52" r="${r}" class="ring2-bg"/>
    <circle cx="52" cy="52" r="${r}" class="ring2-fg" stroke="${color}" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - Math.max(0, Math.min(1, k)))}"/>
    <text x="52" y="52" class="ring2-big">${big}</text><text x="52" y="70" class="ring2-small">${small}</text></svg>`;
}
const scoreColor = (s) => (s >= 80 ? '#5f9f72' : s >= 65 ? '#8fb06a' : s >= 45 ? '#c4a052' : '#c86464');

export const foodScreen = {
  render(params) {
    const t = targets();
    if (!t) return `<main class="content no-title has-tabbar food">${setupIntro()}${suppCard()}</main>${tabBar('food')}`;
    const today = dateStr();
    const ds = params.date || today;
    const list = entriesOf(ds).slice().sort((a, b) => a.t - b.t);
    const sum = sumOf(list);
    const left = t.kcal - sum.kcal;
    const dayName = ds === today ? 'Heute' : ds === dateStr(addDays(new Date(), -1)) ? 'Gestern' : fmtDateLong(ds);
    const hs = healthScore(ds, t);
    const water = waterOf(ds), wTarget = waterTarget(ds);

    return `<main class="content no-title has-tabbar food">
      <div class="day-switch">
        <button class="icon-btn sm" data-action="prevDay" aria-label="Vorheriger Tag">${ICON.chevL}</button>
        <b>${dayName}</b>
        <button class="icon-btn sm" data-action="nextDay" ${ds >= today ? 'disabled' : ''} aria-label="Nächster Tag">${ICON.chevR}</button>
      </div>

      <section class="card kcal-card">
        <button class="kcal-tap" data-action="dayFood" aria-label="${dayName}: Einträge, Ziel und Verlauf">
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
        <span class="kcal-more">${list.length ? `${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'} ändern` : 'Noch nichts eingetragen'} · Ziel ${GOALS[profile().goal || 'bulk'][0]}${adjustHint() || t.warn.length ? ' · <b class="warn-text">Hinweis</b>' : ''}<span class="chev">${ICON.chev}</span></span>
        </button>
        <button class="btn primary big full" data-action="add">${ICON.plus} Essen eintragen</button>
      </section>

      <section class="card rings">
        <button class="ring-box" data-action="health" aria-label="Ernährungsqualität: Details">
          ${hs ? ring(hs.score / 100, scoreColor(hs.score), hs.score, 'von 100') : ring(0, '#5f9f72', '–', 'noch leer')}
          <span class="ring-label">Ernährung</span><span class="muted small">${hs ? hs.label : 'Essen eintragen'}</span>
        </button>
        <div class="ring-box">
          ${ring(water / wTarget, '#7fa9cf', fmtL(water).replace(' L', ''), `von ${fmtL(wTarget)}`)}
          <span class="ring-label">Wasser</span>
          ${ds === today ? `<span class="water-btns"><button class="chip" data-action="water" data-ml="250">+250 ml</button><button class="chip" data-action="water" data-ml="500">+0,5 L</button></span>
          ${water ? '<button class="text-btn muted water-undo" data-action="waterUndo">Letztes zurücknehmen</button>' : ''}` : ''}
        </div>
      </section>

      ${suppCard(ds)}

    </main>${tabBar('food')}`;
  },

  actions: {
    ...suppActions,
    dayFood: () => openDayFood(ui.params.date || dateStr()),
    setup: () => openGoalSheet(),
    goal: () => openGoalSheet(),
    add: () => openAddSheet(),
    health: () => openHealthSheet(),
    water: (el) => { logWater(Number(el.dataset.ml)); render(); },
    waterUndo: () => { undoWater(); render(); },
    del: (el) => { removeFood(el.dataset.id); render(); },
    editEntry: (el) => openEntryEdit(el.dataset.id),
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

function goalCard(t) {
  const n = profile();
  const hint = adjustHint();
  const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
  const kg = Math.abs(Math.round(toW(t.weekly) * 100) / 100);
  const tempo = t.rate ? `${sign(t.rate)}${fmtNum(kg)} ${wu()}/Woche (${sign(t.rate)}${fmtNum(Math.abs(Math.round(t.rate * 100) / 100))} %)` : 'Gewicht halten';
  const plan = t.plan ? `<p class="goal-line">Ziel: <b>${fmtW(t.plan.target)} bis ${fmtDateLong(t.plan.date)}</b> · noch ${Math.round(t.plan.weeks)} Wochen</p>` : '';
  const src = t.measured
    ? `Bedarf <b>${fmtBig(t.tdee)} kcal</b> – gemessen aus ${t.measured.days} Tagen (Ø ${fmtBig(t.measured.intake)} kcal gegessen, Gewicht ${sign(t.measured.kgPerWeek)}${fmtNum(Math.abs(Math.round(toW(t.measured.kgPerWeek) * 100) / 100))} ${wu()}/Woche). Formel hätte ${fmtBig(t.est)} kcal geschätzt.`
    : `Bedarf ca. <b>${fmtBig(t.tdee)} kcal</b> (geschätzt: Grundumsatz ${fmtBig(t.bmr)} kcal + Alltag + Training). Nach ~2 Wochen mit Einträgen und Gewicht misst die App deinen echten Bedarf.`;
  return `<section class="card goal-card">
    <div class="card-head"><h2>Ziel: ${GOALS[n.goal || 'bulk'][0]}</h2><button class="chip" data-action="goal">Anpassen</button></div>
    ${plan}
    <p class="goal-line">Tempo: <b>${tempo}</b> · ${t.delta >= 0 ? 'Überschuss' : 'Defizit'} ${sign(t.delta)}${fmtBig(Math.abs(t.delta))} kcal/Tag${n.adjust ? ` · Korrektur ${sign(n.adjust)}${Math.abs(n.adjust)}` : ''}${n.kcal ? ' · feste Vorgabe' : ''}</p>
    <p class="goal-line muted small">${src}</p>
    ${t.warn.map((w) => `<p class="warn-box">${esc(w)}</p>`).join('')}
    ${hint ? `<div class="hint-box"><p>${esc(hint.text)}</p><button class="chip" data-action="applyHint" data-d="${hint.delta}">Übernehmen</button></div>` : ''}
  </section>`;
}

function setupIntro() {
  return `<section class="card empty">
    <div class="empty-icon">${ICON.food}</div>
    <h2>Kalorien, Protein & Wasser</h2>
    <p class="muted">Ein paar Angaben zu Körper, Alltag und Training – daraus berechnet die App dein Tagesziel. Nach etwa zwei Wochen mit Einträgen misst sie deinen echten Bedarf und wird damit genauer als jede Formel.</p>
    <button class="btn primary big full" data-action="setup">Ziel einrichten</button>
  </section>`;
}

// ---------- Ziel einrichten (ausführlich) ----------

function openGoalSheet() {
  const n = profile();
  const w = weightNow();
  const st = {
    sex: n.sex || 'm', goal: n.goal || 'bulk', job: n.job || (n.activity ? 1.6 : 1.6), level: n.level || 'intermediate',
    sport: n.sport || 'none', trainDays: n.trainDays ?? 4,
  };
  const seg = (name, opts, cls = '') => `<div class="seg-wrap seg-full ${cls}" role="group">${opts.map(([v, l]) => `<button class="seg-item${String(st[name]) === String(v) ? ' on' : ''}" data-action="pick" data-name="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const field = (id, val, ph, unit, mode = 'decimal') => `<label class="gfield"><span>${unit}</span><input id="${id}" inputmode="${mode}" value="${val ?? ''}" placeholder="${ph}" autocomplete="off"></label>`;
  openSheet(`<h2 class="sheet-title">Dein Ziel</h2>
    <h3 class="sheet-h">Ziel</h3>${seg('goal', Object.entries(GOALS).map(([k, g]) => [k, g[0]]))}
    <div class="two">
      ${field('gTarget', n.targetWeight ? fmtW(n.targetWeight, false) : '', 'optional', `Zielgewicht (${wu()})`)}
      <label class="gfield"><span>bis (Datum)</span><input id="gDate" type="date" value="${n.targetDate || ''}" min="${dateStr(addDays(new Date(), 7))}"></label>
    </div>
    <p class="note">Optional: Wie viel willst du bis wann wiegen? Die App rechnet das nötige Tempo aus und warnt, wenn es unrealistisch ist.</p>

    <h3 class="sheet-h">Körper</h3>
    ${seg('sex', [['m', 'Männlich'], ['f', 'Weiblich']])}
    <div class="goal-fields">${field('gAge', n.age, '18', 'Alter', 'numeric')}${field('gHeight', n.height, '180', 'Größe (cm)', 'numeric')}${field('gWeight', w ? fmtW(w, false) : '', wu() === 'lb' ? '165' : '75', `Gewicht (${wu()})`)}</div>
    <div class="two">${field('gFat', n.bodyFat ? fmtNum(n.bodyFat) : '', 'optional', 'Körperfett (%)')}</div>
    <p class="note">Körperfett macht die Rechnung genauer (Katch-McArdle) – nur eintragen, wenn gemessen (z. B. Caliper, gute Waage). Grobe Orientierung Männer: Sixpack sichtbar ≈ 10–12 %, flacher Bauch ≈ 15 %.</p>

    <h3 class="sheet-h">Alltag (ohne Training)</h3>
    <div class="drinks">${JOBS.map(([f, l, d]) => `<button class="drink act${st.job === f ? ' on' : ''}" data-action="pick" data-name="job" data-v="${f}"><span><span class="drink-name">${l}</span><br><span class="muted small">${d}</span></span><span class="copy-check">${ICON.check}</span></button>`).join('')}</div>
    <div class="two">${field('gSteps', n.steps || '', 'optional', 'Schritte pro Tag', 'numeric')}</div>
    <p class="note">Schritte sind genauer als die Auswahl oben – Durchschnitt der letzten Wochen aus der Health-App (iPhone) bzw. Google Fit.</p>

    <h3 class="sheet-h">Krafttraining</h3>
    <p class="muted small" style="margin:0 2px 6px">Einheiten pro Woche</p>
    ${seg('trainDays', [0, 1, 2, 3, 4, 5, 6, 7].map((d) => [d, d]), 'seg-8')}
    <div class="two">${field('gMin', n.trainMin || 60, '60', 'Minuten pro Einheit', 'numeric')}</div>
    <p class="muted small" style="margin:10px 2px 6px">Trainingserfahrung (bestimmt das Aufbau-Tempo)</p>
    ${seg('level', Object.entries(LEVELS).map(([k, l]) => [k, l[0]]))}

    <h3 class="sheet-h">Weiterer Sport</h3>
    ${seg('sport', Object.entries(SPORTS).map(([k, s]) => [k, s[0]]), 'seg-wrap7')}
    <div class="two">${field('gSportH', n.sportHours ? fmtNum(n.sportHours) : '', '0', 'Stunden pro Woche')}</div>

    <h3 class="sheet-h">Feste Kalorien (optional)</h3>
    <div class="two">${field('gKcal', n.kcal || '', 'automatisch', 'kcal pro Tag', 'numeric')}</div>
    <div class="sheet-actions" style="margin-top:16px"><button class="btn primary big" data-action="saveGoal">Speichern</button></div>
    <p class="source">Grundumsatz: Mifflin-St Jeor bzw. Katch-McArdle (mit KFA). Alltag: PAL nach DGE oder aus Schritten. Training: MET-Werte (Compendium of Physical Activities 2024). Aufbau-Tempo nach Erfahrung (Aragon), Diät ≤ 1 %/Woche. Protein 1,8 g/kg, Diät 2,2 g/kg (Morton 2018). 1 kg Körpergewicht ≈ 7.700 kcal (Näherung). Alles sind Schätzungen – die Messung aus deinen Daten ersetzt sie automatisch.</p>`, {
    pick: (el) => {
      const name = el.dataset.name;
      st[name] = ['job', 'trainDays'].includes(name) ? Number(el.dataset.v) : el.dataset.v;
      el.parentElement.querySelectorAll(`[data-name="${name}"]`).forEach((b) => b.classList.toggle('on', b === el));
    },
    saveGoal: () => {
      const v = (id) => { const x = parseNum(document.getElementById(id).value); return Number.isNaN(x) ? NaN : x; };
      const age = v('gAge'), height = v('gHeight'), weight = fromW(v('gWeight'));
      if (!age || !height || !weight || [age, height, weight].some(Number.isNaN) || age < 12 || age > 100 || height < 120 || height > 230 || weight < 30 || weight > 300) {
        return toast('Bitte Alter, Größe und Gewicht prüfen');
      }
      const fat = v('gFat'), steps = v('gSteps'), min = v('gMin'), sportH = v('gSportH'), kcal = v('gKcal'), target = fromW(v('gTarget'));
      const date = document.getElementById('gDate').value;
      if (fat && (Number.isNaN(fat) || fat < 4 || fat > 50)) return toast('Körperfett zwischen 4 und 50 %');
      if (target && (Number.isNaN(target) || target < 35 || target > 250)) return toast('Zielgewicht prüfen');
      if ((target && !date) || (!target && date)) return toast('Für ein Ziel bitte Gewicht und Datum angeben');
      saveProfile({
        ...st, age: Math.round(age), height: Math.round(height), weight: Math.round(weight * 100) / 100,
        bodyFat: fat || null, steps: steps && !Number.isNaN(steps) ? Math.round(steps) : null,
        trainMin: min && !Number.isNaN(min) ? Math.round(min) : 60, sportHours: sportH && !Number.isNaN(sportH) ? sportH : 0,
        targetWeight: target || null, targetDate: date || null,
        kcal: kcal && !Number.isNaN(kcal) ? Math.round(kcal) : null, adjust: 0, activity: undefined,
      });
      closeSheet();
      toast('Ziel gespeichert');
      render();
    },
  });
}

// ---------- Ernährungsqualität ----------

function openHealthSheet() {
  const ds = ui.params.date || dateStr();
  const hs = healthScore(ds);
  if (!hs) return toast('Erst Essen eintragen – dann gibt es eine Bewertung');
  const worst = [...hs.parts].sort((a, b) => a.pts / a.max - b.pts / b.max).slice(0, 3).filter((p) => p.pts / p.max < 0.9);
  openSheet(`<h2 class="sheet-title">Ernährung: ${hs.score} / 100</h2>
    <div class="health-top">${ring(hs.score / 100, scoreColor(hs.score), hs.score, hs.label, 120)}</div>
    ${ds === dateStr() ? '<p class="note center-text" style="margin:-4px 0 12px">Der Tag läuft noch – Kalorien, Obst, Gemüse und Wasser füllen sich bis heute Abend.</p>' : ''}
    <div class="health-list">${hs.parts.map((p) => `<div class="hp">
      <div class="hp-row"><span>${p.name}</span><span class="muted small">${p.val}</span><b>${fmtNum(Math.round(p.pts))}/${p.max}</b></div>
      ${bar(p.pts, p.max, p.pts / p.max >= 0.8 ? 'p' : p.pts / p.max >= 0.4 ? 'c' : 'bad')}</div>`).join('')}</div>
    ${worst.length ? `<h3 class="sheet-h">So wird's besser</h3><ul class="tips">${worst.map((p) => `<li><b>${p.name}:</b> ${p.tip}</li>`).join('')}</ul>` : ''}
    ${hs.coverage < 0.7 ? '<p class="note">Ein Teil des Tages ist per Schnelleintrag ohne Details erfasst – Ballaststoffe, Zucker, Obst und Gemüse fehlen dann in der Bewertung.</p>' : ''}
    <p class="source">Bewertung nach DGE (Gemüse, Obst, Ballaststoffe), WHO (freier Zucker, gesättigte Fette) und Sporternährung (Protein, Kalorienziel, Wasser).</p>`);
}

// ---------- Essen eintragen ----------

function openAddSheet() {
  let results = searchLocal('');
  let online = [];
  let timer, ctrl;
  const list = () => {
    const tag = (f) => (f.meal ? ' <span class="uni-tag">Gericht</span>' : f.mine ? ` <span class="uni-tag mine">${f.code ? 'Gescannt' : 'Eigenes'}</span>` : f.shared ? ' <span class="uni-tag shared">Gym-Nutzer</span>' : '');
    const item = (f, i) => `<button class="drink" data-action="pick" data-i="${i}"><span class="drink-name">${esc(f.name)}${tag(f)}</span>
      <span class="drink-meta">${f.meal ? `<b>${fmtBig(f.kcal * f.portion / 100)}</b> kcal · ${fmtNum(Math.round(f.p * f.portion / 10) / 10)} g P <small>/Portion</small>` : `<b>${f.kcal}</b> kcal · ${fmtNum(f.p)} g P <small>/100 ${f.liquid ? 'ml' : 'g'}</small>`}</span></button>`;
    return (results.length ? results.map((f, i) => item(f, i)).join('') : '')
      + (online.length ? `<div class="drinks-sep">Online (Gym-Nutzer + Open Food Facts)</div>${online.map((f, i) => item(f, results.length + i)).join('')}` : '')
      || '<p class="muted small pad">Nichts gefunden – unten „Schnell eintragen“ nutzen.</p>';
  };
  const redraw = () => { const el = document.getElementById('foodRes'); if (el) el.innerHTML = list(); };
  openSheet(`<h2 class="sheet-title">Essen eintragen</h2>
    <div class="add-row">
      <input id="foodQ" class="input" placeholder="Suchen, z. B. Skyr, Haferflocken" autocomplete="off" data-input="q" enterkeyhint="search">
      ${canScan() ? `<button class="btn" data-action="scan" aria-label="Barcode scannen">${ICON.barcode}</button>` : ''}
    </div>
    <p class="muted small" id="onlineState" style="margin:6px 2px 0"></p>
    <div class="own-btns">
      <button class="btn dashed" data-action="newFood">${ICON.plus} Eigene Zutat</button>
      <button class="btn dashed" data-action="newMeal">${ICON.plus} Eigenes Gericht</button>
    </div>
    <div class="drinks food-res" id="foodRes">${list()}</div>
    <h3 class="sheet-h">Schnell eintragen</h3>
    <input id="qName" class="input" placeholder="Name (optional)" maxlength="40" autocomplete="off" style="margin-bottom:8px">
    <div class="quick-grid">
      <label class="field sm"><input id="qKcal" inputmode="numeric" placeholder="auto"><span>kcal</span></label>
      <label class="field sm"><input id="qP" inputmode="decimal" placeholder="0"><span>g Protein</span></label>
      <label class="field sm"><input id="qC" inputmode="decimal" placeholder="0"><span>g KH</span></label>
      <label class="field sm"><input id="qF" inputmode="decimal" placeholder="0"><span>g Fett</span></label>
    </div>
    <p class="note">Ohne kcal-Angabe rechnet die App aus den Makros: Protein und KH je 4 kcal/g, Fett 9 kcal/g.</p>
    <div class="sheet-actions"><button class="btn big" data-action="quick">Eintragen</button></div>
    <p class="source">Lebensmittel: eingebaute Liste und ${DB_SOURCE}. Markenprodukte: von Gym-Nutzern gescannt und Open Food Facts (online).</p>`, {
    inputs: {
      q: (el) => {
        const q = el.value;
        results = searchLocal(q);
        online = [];
        redraw();
        clearTimeout(timer);
        ctrl?.abort();
        const stEl = document.getElementById('onlineState');
        if (q.trim().length < 3) { stEl.textContent = ''; return; }
        stEl.textContent = 'Suche auch online …';
        timer = setTimeout(async () => {
          ctrl = new AbortController();
          try {
            online = (await searchOnline(q.trim(), ctrl.signal)).filter((f) => !results.some((r) => r.name === f.name));
            stEl.textContent = online.length ? '' : 'Online nichts gefunden.';
            redraw();
          } catch (e) {
            if (e.name !== 'AbortError') stEl.textContent = 'Online-Suche gerade nicht erreichbar.';
          }
        }, 450);
      },
    },
    pick: (el) => openAmountSheet([...results, ...online][Number(el.dataset.i)]),
    newMeal: () => openMealBuilder(),
    newFood: () => openFoodForm(),
    quick: () => {
      const num = (id) => { const x = parseNum(document.getElementById(id).value); return x && !Number.isNaN(x) ? x : 0; };
      const vals = { kcal: num('qKcal'), p: num('qP'), c: num('qC'), f: num('qF') };
      if (!vals.kcal && !vals.p && !vals.c && !vals.f) return toast('Kalorien oder Makros eingeben');
      const e = logQuick(document.getElementById('qName').value.trim(), vals);
      closeSheet(); toast(`${e.kcal} kcal eingetragen`); render();
    },
    scan: () => scanBarcode(),
  });
  setTimeout(() => document.getElementById('foodQ')?.focus(), 350);
  // Große Datenbank im Hintergrund laden; ist schon gesucht worden, Ergebnis auffrischen
  if (!foodDbReady()) loadFoodDb().then(() => { const q = document.getElementById('foodQ'); if (q?.value.trim()) { results = searchLocal(q.value); redraw(); } });
}

function openAmountSheet(food) {
  if (!food) return;
  // Getränk mit bekannter Flaschengröße: standardmäßig die ganze Flasche
  const start = food.lastG || (food.liquid && food.pack ? food.pack : food.portion) || 100;
  const u = food.liquid ? 'ml' : 'g';
  const calc = (g) => `<b>${fmtBig(food.kcal * g / 100)}</b> kcal · ${fmtNum(Math.round(food.p * g / 10) / 10)} g Protein · ${fmtNum(Math.round(food.c * g / 10) / 10)} g KH · ${fmtNum(Math.round(food.f * g / 10) / 10)} g Fett`;
  const chips = [
    ...(food.pack ? [[food.pack, `${food.liquid ? 'Ganze Flasche' : 'Ganze Packung'} (${fmtBig(food.pack)} ${u})`]] : []),
    [food.portion, food.portion === food.pack ? null : `1 ${food.unit && food.unit !== 'Flasche' ? food.unit : 'Portion'}`],
    [food.portion * 2, food.portion === food.pack ? `2 ${food.liquid ? 'Flaschen' : 'Packungen'}` : `2 ${food.unit && food.unit !== 'Flasche' ? food.unit : 'Portionen'}`],
    [100, `100 ${u}`],
  ].filter(([g, l], i, a) => g && l && a.findIndex(([x]) => x === g) === i);
  openSheet(`<h2 class="sheet-title">${esc(food.name)}</h2>
    <p class="muted small sheet-sub">${food.meal ? `Ganzes Gericht ${fmtBig(food.totalG)} g · 1 Portion = ${fmtBig(food.portion)} g · ` : ''}Je 100 ${food.liquid ? 'ml' : 'g'}: ${food.kcal} kcal · ${fmtNum(food.p)} g Protein${food.fib ? ` · ${fmtNum(food.fib)} g Ballaststoffe` : ''}</p>
    <label class="field amount"><input id="aG" inputmode="decimal" value="${start}" data-input="g" data-enter="log"><span>${food.liquid ? 'ml' : 'g'}</span></label>
    <div class="chips amount-chips">${chips.map(([g, l]) => `<button class="chip" data-action="setG" data-g="${g}">${l}</button>`).join('')}</div>
    <p class="amount-calc" id="aCalc">${calc(start)}</p>
    <div class="sheet-actions"><button class="btn primary big" data-action="log">Eintragen</button>
      ${food.meal ? '<div class="row"><button class="btn" data-action="editMeal">Gericht bearbeiten</button><button class="btn ghost danger" data-action="delMeal">Löschen</button></div>' : ''}
      ${food.mine ? `<div class="row"><button class="btn" data-action="editFood">${food.code ? 'Nährwerte ändern' : 'Bearbeiten'}</button><button class="btn ghost danger" data-action="delFood">Aus Liste</button></div>` : ''}</div>
    ${food.mine || food.shared ? `<p class="source">${food.code ? `Barcode ${esc(food.code)} · für alle Gym-Nutzer` : 'Selbst angelegt · nur für dich'}</p>` : ''}`, {
    editFood: () => openFoodForm(food),
    delFood: async () => {
      closeSheet();
      if (!(await ask(`„${food.name}“ aus deiner Liste?`, 'Bereits eingetragenes Essen bleibt erhalten.', 'Entfernen', true))) return;
      deleteMyFood(food.id); toast('Entfernt'); render();
    },
    editMeal: () => openMealBuilder(meals().find((m) => m.id === food.mealId)),
    delMeal: async () => {
      closeSheet();
      if (!(await ask(`„${food.name}“ löschen?`, 'Bereits eingetragene Mahlzeiten bleiben erhalten.', 'Löschen', true))) return;
      deleteMeal(food.mealId); toast('Gericht gelöscht'); render();
    },
    inputs: { g: (el) => { const g = parseNum(el.value); if (g && !Number.isNaN(g)) document.getElementById('aCalc').innerHTML = calc(g); } },
    setG: (el) => { document.getElementById('aG').value = el.dataset.g; document.getElementById('aCalc').innerHTML = calc(+el.dataset.g); },
    log: () => {
      const g = parseNum(document.getElementById('aG').value);
      if (!g || Number.isNaN(g) || g > 5000) return toast(food.liquid ? 'Menge in ml eingeben' : 'Menge in Gramm eingeben');
      const e = logFood(food, g);
      closeSheet();
      toast(`${food.name}: ${e.kcal} kcal eingetragen`);
      ui.params.date = null;
      render();
    },
  });
}

// ---------- Tagesübersicht (Kalorien-Karte antippen) ----------
// Alles, was zu den Kalorien gehört: Einträge (antippen = ändern), Ziel, letzte 7 Tage.

function openDayFood(ds) {
  const t = targets();
  const today = dateStr();
  const list = entriesOf(ds).slice().sort((a, b) => a.t - b.t);
  const dayName = ds === today ? 'Heute' : ds === dateStr(addDays(new Date(), -1)) ? 'Gestern' : fmtDateLong(ds);
  const rows = list.map((x) => `<button class="list-row food-row" data-action="editEntry" data-id="${esc(x.id)}">
      <span class="lr-main"><span class="lr-title">${esc(x.name)}</span>
        <span class="lr-sub">${x.g ? `${fmtBig(x.g)} ${x.ref?.liquid ? 'ml' : 'g'} · ` : ''}P ${fmtNum(Math.round(x.p))} · KH ${fmtNum(Math.round(x.c || 0))} · F ${fmtNum(Math.round(x.f || 0))} · ${new Date(x.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></span>
      <span class="lr-value">${fmtBig(x.kcal)}<small> kcal</small></span><span class="chev">${ICON.chev}</span></button>`).join('');
  const week = lastDays(7);
  const chart = columnChart(week.days.map((d) => ({
    label: WD_SHORT[weekdayIdx(parseDate(d.ds))], done: d.kcal, planned: t.kcal,
    tip: `${fmtDateLong(d.ds)}: ${d.has ? `${fmtBig(d.kcal)} kcal, ${Math.round(d.p)} g Protein` : 'nichts eingetragen'}`,
  })), { height: 130 });
  openSheet(`<h2 class="sheet-title">${dayName === 'Heute' ? 'Heute gegessen' : `Gegessen · ${dayName}`}</h2>
    ${rows ? `<div class="list-card sheet-list-card">${rows}</div><p class="muted small sheet-sub">Eintrag antippen zum Ändern oder Löschen.</p>` : '<p class="muted">Noch nichts eingetragen.</p>'}
    ${ds === today ? `<button class="btn primary big full" data-action="add">${ICON.plus} Essen eintragen</button>` : ''}
    <h3 class="sheet-h">Ziel</h3>
    ${goalCard(t)}
    <h3 class="sheet-h">Letzte 7 Tage <span class="muted small">${week.avg ? `· Ø ${fmtBig(week.avg.kcal)} kcal · ${week.avg.p} g Protein` : ''}</span></h3>
    <section class="card chart-card">${chart}<p class="chart-tip" id="weekTip">Balken antippen für Details. Heller Balken = Ziel.</p></section>`, {
    editEntry: (el) => openEntryEdit(el.dataset.id, ds),
    add: () => openAddSheet(),
    goal: () => openGoalSheet(),
    applyHint: (el) => { saveProfile({ adjust: (profile().adjust || 0) + Number(el.dataset.d), kcal: null }); toast('Ziel angepasst'); render(); openDayFood(ds); },
    tip: (el) => {
      document.querySelectorAll('#sheet .chart .hit.sel').forEach((h) => h.classList.remove('sel'));
      el.classList.add('sel');
      el.closest('svg').classList.add('has-sel');
      document.getElementById('weekTip').textContent = el.dataset.tip;
    },
  });
}

// ---------- Eingetragenes Essen ändern ----------

function openEntryEdit(id, ds = ui.params.date || dateStr()) {
  const x = entriesOf(ds).find((e) => e.id === id);
  if (!x) return;
  const time = new Date(x.t).toTimeString().slice(0, 5);
  const unit = x.ref?.liquid ? 'ml' : 'g';
  const byAmount = !!x.g;
  const calc = (g) => { const k = g / x.g; return `<b>${fmtBig(x.kcal * k)}</b> kcal · ${fmtNum(Math.round(x.p * k * 10) / 10)} g Protein · ${fmtNum(Math.round(x.c * k * 10) / 10)} g KH · ${fmtNum(Math.round(x.f * k * 10) / 10)} g Fett`; };
  const qf = (id2, v, label) => `<label class="field sm"><input id="${id2}" inputmode="decimal" value="${v ? fmtNum(v) : ''}" placeholder="0"><span>${label}</span></label>`;
  openSheet(`<h2 class="sheet-title">Eintrag ändern</h2>
    <label class="gfield"><span>Name</span><input id="eName" value="${esc(x.name)}" maxlength="60" autocomplete="off"></label>
    ${byAmount ? `<label class="field amount"><input id="eG" inputmode="decimal" value="${x.g}" data-input="eg" data-enter="saveEntry"><span>${unit}</span></label>
      <p class="amount-calc" id="eCalc">${calc(x.g)}</p>`
    : `<div class="quick-grid">${qf('eKcal', x.kcal, 'kcal')}${qf('eP', x.p, 'g Protein')}${qf('eC', x.c, 'g KH')}${qf('eF', x.f, 'g Fett')}</div>`}
    <label class="gfield inline"><span>Uhrzeit</span><input id="eTime" type="time" value="${time}"></label>
    <div class="sheet-actions"><button class="btn primary big" data-action="saveEntry">Speichern</button>
      <button class="btn ghost big danger" data-action="delEntry">${ICON.trash} Löschen</button>
      <button class="btn ghost big" data-action="backDay">${ICON.back} Zurück zur Übersicht</button></div>`, {
    inputs: { eg: (el) => { const g = parseNum(el.value); if (g && !Number.isNaN(g)) document.getElementById('eCalc').innerHTML = calc(g); } },
    saveEntry: () => {
      const num = (i) => { const v = parseNum(document.getElementById(i)?.value); return v == null || Number.isNaN(v) ? null : v; };
      const patch = { name: document.getElementById('eName').value.trim(), time: document.getElementById('eTime').value };
      if (byAmount) {
        const g = num('eG');
        if (!g || g > 5000) return toast(`Menge in ${unit} eingeben`);
        patch.g = g;
      } else {
        Object.assign(patch, { kcal: num('eKcal') || 0, p: num('eP') || 0, c: num('eC') || 0, f: num('eF') || 0 });
        if (!patch.kcal && !patch.p && !patch.c && !patch.f) return toast('Kalorien oder Makros eingeben');
      }
      updateFood(x.id, patch);
      toast('Eintrag geändert'); render(); openDayFood(ds);
    },
    delEntry: () => { removeFood(x.id); toast('Eintrag gelöscht'); render(); openDayFood(ds); },
    backDay: () => openDayFood(ds),
  });
}

// ---------- Eigenes Gericht erstellen / bearbeiten (eigene Seite) ----------
// Früher ein Wisch-Fenster – da ging beim Scrollen leicht alles verloren.
// Jetzt eine eigene Seite; jeder Schritt wird sofort als Entwurf gespeichert
// (auch Verlassen oder App schließen verliert nichts).

const DRAFT = 'gym.mealDraft';
let mst = null; // { id?, name, servings, items: [ { food, g } ] }
let mRes = [], mOnline = [], mTimer, mCtrl;

function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify(mst)); } catch { /* egal */ } }
function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } }
function clearDraft() { try { localStorage.removeItem(DRAFT); } catch { /* egal */ } mst = null; }

function openMealBuilder(meal = null) {
  const d = loadDraft();
  const fromMeal = meal ? { id: meal.id, name: meal.name, servings: meal.servings || 1, items: meal.items.map((x) => ({ ...x })) } : null;
  if (d && (d.items?.length || d.name) && (!meal || d.id === meal.id)) {
    mst = d;
    setTimeout(() => toast('Entwurf fortgesetzt'), 400);
  } else mst = fromMeal || { name: '', servings: 1, items: [] };
  saveDraft();
  mRes = []; mOnline = [];
  go('meal');
}

function mealTotalsHtml() {
  const t = mealTotals(mst);
  const per = (v) => v / (mst.servings || 1);
  return mst.items.length
    ? `<div class="meal-sum"><div><span>Ganzes Gericht</span><b>${fmtBig(t.kcal)} kcal</b><small>${fmtBig(t.g)} g · P ${Math.round(t.p)} · KH ${Math.round(t.c)} · F ${Math.round(t.f)}</small></div>
       <div><span>Pro Portion (${mst.servings})</span><b>${fmtBig(per(t.kcal))} kcal</b><small>${fmtBig(per(t.g))} g · P ${Math.round(per(t.p))} · KH ${Math.round(per(t.c))} · F ${Math.round(per(t.f))}</small></div></div>`
    : '<p class="muted small pad">Noch keine Zutaten – unten suchen, scannen oder anlegen.</p>';
}
const mealItemsHtml = () => mst.items.map((x, i) => `<div class="meal-item">
    <span class="meal-item-name">${esc(x.food.name)}<small id="mk${i}">${fmtBig(x.food.kcal * x.g / 100)} kcal</small></span>
    <label class="field mini"><input inputmode="decimal" value="${x.g}" data-input="mg" data-i="${i}"><span>${x.food.liquid ? 'ml' : 'g'}</span></label>
    <button class="icon-btn sm" data-action="rmItem" data-i="${i}" aria-label="Entfernen">${ICON.x}</button></div>`).join('');
const mealResHtml = () => [...mRes, ...mOnline].slice(0, 25).map((f, i) => `<button class="drink" data-action="addItem" data-i="${i}">
    <span class="drink-name">${esc(f.name)}${f.mine ? ` <span class="uni-tag mine">${f.code ? 'Gescannt' : 'Eigenes'}</span>` : f.shared ? ' <span class="uni-tag shared">Gym-Nutzer</span>' : ''}</span><span class="drink-meta"><b>${f.kcal}</b> kcal <small>/100 ${f.liquid ? 'ml' : 'g'}</small></span></button>`).join('');
function mealRedraw() {
  const a = document.getElementById('mItems'), b = document.getElementById('mSum');
  if (a) a.innerHTML = mealItemsHtml();
  if (b) b.innerHTML = mealTotalsHtml();
}
const mealRedrawRes = () => { const el = document.getElementById('mRes'); if (el) el.innerHTML = mealResHtml(); };

/** Zutat ins Gericht (aus Suche, Scan oder neu angelegt). */
function mealAdd(f) {
  if (!mst || !f) return;
  mst.items.push({ food: f, g: f.portion || 100 });
  saveDraft();
  mRes = []; mOnline = [];
  const q = document.getElementById('mQ'); if (q) q.value = '';
  mealRedrawRes(); mealRedraw();
  toast(`${f.name} hinzugefügt – Menge anpassen`);
}

export const mealScreen = {
  render() {
    if (!mst) mst = loadDraft() || { name: '', servings: 1, items: [] };
    return `<header class="topbar">
        <button class="glass-circle" data-action="back" aria-label="Zurück">${ICON.back}</button>
        <span class="topbar-mid">${mst.id ? 'Gericht bearbeiten' : 'Eigenes Gericht'}</span>
        <span class="glass-pill"><button data-action="discard">Verwerfen</button></span>
      </header>
      <main class="content meal-page has-footer">
        <label class="gfield"><span>Name</span><input id="mName" value="${esc(mst.name)}" placeholder="z. B. Hähnchen-Reis-Bowl" maxlength="40" autocomplete="off" data-input="mname"></label>
        <h3 class="sheet-h">Ergibt Portionen</h3>
        <div class="seg-wrap seg-full" role="group">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="seg-item${n === mst.servings ? ' on' : ''}" data-action="serv" data-n="${n}">${n}</button>`).join('')}</div>
        <h3 class="sheet-h">Zutaten</h3>
        <div class="meal-items" id="mItems">${mealItemsHtml()}</div>
        <div id="mSum">${mealTotalsHtml()}</div>
        <h3 class="sheet-h">Zutat hinzufügen</h3>
        <div class="add-row">
          <input id="mQ" class="input" placeholder="Suchen, z. B. Reis, Hähnchen" autocomplete="off" data-input="mq" enterkeyhint="search">
          ${canScan() ? `<button class="btn" data-action="mScan" aria-label="Barcode scannen">${ICON.barcode}</button>` : ''}
        </div>
        <p class="muted small" id="mState" style="margin:6px 2px 0"></p>
        <div class="drinks meal-res" id="mRes">${mealResHtml()}</div>
        <button class="btn dashed" data-action="mNewFood">${ICON.plus} Eigene Zutat anlegen</button>
        <p class="note">Wird automatisch als Entwurf gemerkt – du kannst die Seite verlassen und später weitermachen.</p>
      </main>
      <footer class="bottom"><button class="btn primary big" data-action="saveMeal">Gericht speichern</button></footer>`;
  },
  after() { if (!foodDbReady()) loadFoodDb(); },
  actions: {
    back: () => go('food'),
    discard: async () => {
      if ((mst.items.length || mst.name) && !(await ask('Entwurf verwerfen?', 'Name und Zutaten werden gelöscht.', 'Verwerfen', true))) return;
      clearDraft(); go('food');
    },
    serv: (el) => {
      mst.servings = Number(el.dataset.n); saveDraft();
      el.parentElement.querySelectorAll('.seg-item').forEach((b) => b.classList.toggle('on', b === el));
      document.getElementById('mSum').innerHTML = mealTotalsHtml();
    },
    addItem: (el) => mealAdd([...mRes, ...mOnline][Number(el.dataset.i)]),
    rmItem: (el) => { mst.items.splice(Number(el.dataset.i), 1); saveDraft(); mealRedraw(); },
    mScan: () => scanBarcode({ onFood: mealAdd, onCancel: () => {} }),
    mNewFood: () => openFoodForm(null, '', (f) => { closeSheet(); mealAdd(f); }),
    saveMeal: () => {
      mst.name = document.getElementById('mName').value.trim();
      if (!mst.name) return toast('Bitte einen Namen eingeben');
      if (!mst.items.length) return toast('Mindestens eine Zutat hinzufügen');
      const m = saveMeal(mst);
      clearDraft();
      go('food');
      setTimeout(() => toast(`„${m.name}“ gespeichert – steht beim Eintragen ganz oben`), 300);
    },
  },
  inputs: {
    mname: (el) => { mst.name = el.value; saveDraft(); },
    mg: (el) => {
      const g = parseNum(el.value);
      if (!g || Number.isNaN(g)) return;
      const it = mst.items[+el.dataset.i];
      it.g = g; saveDraft();
      document.getElementById(`mk${el.dataset.i}`).textContent = `${fmtBig(it.food.kcal * g / 100)} kcal`;
      document.getElementById('mSum').innerHTML = mealTotalsHtml();
    },
    mq: (el) => {
      const q = el.value;
      mRes = q.trim() ? searchLocal(q, { withMeals: false }) : [];
      mOnline = [];
      mealRedrawRes();
      clearTimeout(mTimer); mCtrl?.abort();
      const stEl = document.getElementById('mState');
      if (q.trim().length < 3) { stEl.textContent = ''; return; }
      stEl.textContent = 'Suche auch online …';
      mTimer = setTimeout(async () => {
        mCtrl = new AbortController();
        try { mOnline = (await searchOnline(q.trim(), mCtrl.signal)).filter((f) => !mRes.some((r) => r.name === f.name)); stEl.textContent = ''; mealRedrawRes(); }
        catch (e) { if (e.name !== 'AbortError') stEl.textContent = 'Online-Suche gerade nicht erreichbar.'; }
      }, 450);
    },
  },
};

// ---------- Eigenes Lebensmittel anlegen / ändern ----------

/**
 * Nährwerte je 100 g von der Packung abtippen.
 * Ohne Barcode: nur für dich. Mit Barcode (gescannt): auch für alle anderen.
 */
function openFoodForm(food = null, code = food?.code || '', onSaved = openAmountSheet) {
  const v = (k) => (food?.[k] != null && food[k] !== 0 ? fmtNum(food[k]) : '');
  const cats = [['', 'Sonstiges'], ['d', 'Milchprodukt'], ['v', 'Gemüse'], ['o', 'Obst']];
  let cat = food?.cat || '', liquid = !!food?.liquid;
  const field = (id, label, val, ph = '0') => `<label class="gfield"><span>${label}</span><input id="${id}" inputmode="decimal" value="${val}" placeholder="${ph}" autocomplete="off"></label>`;
  openSheet(`<h2 class="sheet-title">${food?.mine ? 'Lebensmittel ändern' : 'Eigenes Lebensmittel'}</h2>
    <p class="muted small sheet-sub">${code ? `Barcode ${esc(code)} – wird für <b>alle Gym-Nutzer</b> gespeichert, damit der Scan beim nächsten Mal sofort klappt.` : 'Nur für dich. Steht danach beim Eintragen ganz oben.'}</p>
    <label class="gfield"><span>Name</span><input id="nfName" value="${esc(food?.name || '')}" placeholder="z. B. Magerquark (Milsani)" maxlength="60" autocomplete="off"></label>
    <h3 class="sheet-h">Nährwerte je 100 <span id="nfU">${liquid ? 'ml' : 'g'}</span> (von der Packung)</h3>
    <div class="nf-grid">
      ${field('nfKcal', 'Kalorien (kcal)', v('kcal'), 'auto')}
      ${field('nfP', 'Eiweiß / Protein (g)', v('p'))}
      ${field('nfC', 'Kohlenhydrate (g)', v('c'))}
      ${field('nfSug', '… davon Zucker (g)', v('sug'))}
      ${field('nfF', 'Fett (g)', v('f'))}
      ${field('nfSat', '… davon gesättigt (g)', v('sat'))}
      ${field('nfFib', 'Ballaststoffe (g)', v('fib'))}
      ${field('nfPortion', 'Portion (g/ml)', food?.portion && food.portion !== 100 ? fmtNum(food.portion) : '', '100')}
    </div>
    <div class="nf-opts">
      <div class="seg-wrap" role="group" aria-label="Art">${cats.map(([k, l]) => `<button class="seg-item${k === cat ? ' on' : ''}" data-action="cat" data-c="${k}">${l}</button>`).join('')}</div>
      <button class="chip sec${liquid ? ' on' : ''}" data-action="liquid" aria-pressed="${liquid}">Getränk (ml)</button>
    </div>
    <p class="note">Kalorien leer lassen = aus den Nährwerten berechnet. „Art“ zählt für den Ernährungs-Kreis (Gemüse/Obst).</p>
    <div class="sheet-actions"><button class="btn primary big" data-action="saveFood">Speichern</button></div>`, {
    cat: (el) => { cat = el.dataset.c; el.parentElement.querySelectorAll('.seg-item').forEach((b) => b.classList.toggle('on', b === el)); },
    liquid: (el) => { liquid = !liquid; el.classList.toggle('on', liquid); el.setAttribute('aria-pressed', liquid); document.getElementById('nfU').textContent = liquid ? 'ml' : 'g'; },
    saveFood: async () => {
      const num = (id) => { const x = parseNum(document.getElementById(id).value); return x == null || Number.isNaN(x) ? 0 : x; };
      const f = {
        id: food?.mine ? food.id : undefined, code: code || undefined,
        name: document.getElementById('nfName').value.trim(),
        kcal: num('nfKcal'), p: num('nfP'), c: num('nfC'), sug: num('nfSug'), f: num('nfF'), sat: num('nfSat'), fib: num('nfFib'),
        portion: num('nfPortion') || 100, cat, liquid,
      };
      f.unit = f.portion !== 100 ? 'Portion' : '100 g';
      if (!f.kcal) f.kcal = Math.round(f.p * 4 + f.c * 4 + f.f * 9 + f.fib * 2);
      const err = checkFood(f);
      if (err) return toast(err);
      const saved = saveMyFood(f);
      if (code) {
        const ok = await communityAdd(saved);
        toast(ok ? 'Gespeichert – jetzt für alle scannbar' : 'Gespeichert (für alle teilen klappt gerade nicht – nur bei dir)');
      } else toast('Gespeichert – steht beim Eintragen ganz oben');
      onSaved(saved);
    },
  });
  setTimeout(() => document.getElementById(food?.name ? 'nfKcal' : 'nfName')?.focus(), 350);
}

// ---------- Barcode scannen (Kamera + Eintippen: siehe scanner.js) ----------

/** target: { onFood(food), onCancel() } – Standard: Essen eintragen. */
function scanBarcode(target = { onFood: openAmountSheet, onCancel: openAddSheet }) {
  scanCode({ onCode: (code) => lookupCode(code, target), onCancel: target.onCancel || (() => {}) });
}

async function lookupCode(code, target = { onFood: openAmountSheet }) {
  toast('Suche Produkt …');
  const food = await byBarcode(code).catch(() => null);
  if (food) { target.onFood(food); return; }
  toast('Noch nicht bekannt – Nährwerte von der Packung eintragen');
  openFoodForm(null, code, (f) => { closeSheet(); target.onFood(f); });
}
