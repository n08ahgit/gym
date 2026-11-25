// =============================================================
// exinfo.js – Fenster "Ausführung & Tipps" und Scheibenrechner
// (aus dem Workout und dem Plan-Editor heraus geöffnet)
// =============================================================

import { openSheet } from '../app.js';
import { data, save } from '../store.js';
import { esc, fmtNum, fmtClock, parseNum } from '../util.js';
import { getExercise, muscleNames } from '../exercises.js';
import { tipsFor } from '../tips.js';
import { repRange, restAdvice, suggest, platesFor, PLATES } from '../coach.js';

/** Fenster mit Ausführung, Wdh.-Bereich, Pause und Steigerung für eine Übung. */
export function openExerciseInfo(exId, fallbackName = '') {
  const ex = getExercise(exId);
  const name = ex?.name || fallbackName;
  const range = repRange(exId);
  const [rLo, rHi] = restAdvice(exId);
  const sug = suggest(exId);
  const cues = tipsFor(exId).map((t) => `<li>${esc(t)}</li>`).join('');

  openSheet(`<h2 class="sheet-title">${esc(name)}</h2>
    ${ex ? `<p class="muted small sheet-sub">${esc(muscleNames(ex.primary))}${ex.secondary?.length ? ` · hilft: ${esc(muscleNames(ex.secondary))}` : ''}</p>` : ''}
    <h3 class="sheet-h">Ausführung</h3>
    <ol class="cue-list">${cues}</ol>
    <h3 class="sheet-h">Für maximalen Muskelaufbau</h3>
    <dl class="facts-list">
      ${range ? `<div><dt>Wiederholungen</dt><dd>${range[0]}–${range[1]} pro Satz</dd></div>` : '<div><dt>Belastung</dt><dd>Zeit statt Wiederholungen</dd></div>'}
      <div><dt>Satzende</dt><dd>1–3 Wdh. vor dem Muskelversagen${range && range[0] >= 10 ? ', letzter Satz gern bis zum Versagen' : ''}</dd></div>
      <div><dt>Pause</dt><dd>${fmtClock(rLo)}–${fmtClock(rHi)} min</dd></div>
      <div><dt>Tempo</dt><dd>2–3 s absenken, zügig hoch</dd></div>
      <div><dt>Wochenvolumen</dt><dd>10–20 harte Sätze pro Muskel, auf ≥ 2 Tage verteilt</dd></div>
    </dl>
    <h3 class="sheet-h">Heute</h3>
    <p class="coach-why">${esc(sug.why)}</p>
    <p class="source">Basis: Meta-Analysen zu Volumen, Nähe zum Muskelversagen, Pausen und Bewegungsumfang (u. a. Schoenfeld 2017, Refalo 2023, Robinson 2024, Pelland 2024, Wolf 2025).</p>`);
}

/** Scheibenrechner: welche Scheiben pro Seite? */
export function openPlates(startKg) {
  let total = startKg || 60;
  const draw = () => {
    const bar = data.settings.bar || 20;
    const res = platesFor(total, bar);
    const plates = res.plates.map((p) => `<i class="plate p${String(p).replace('.', '_')}" style="--h:${40 + (p / 25) * 60}%" title="${fmtNum(p)} kg"></i>`).join('');
    const list = res.plates.length
      ? Object.entries(res.plates.reduce((m, p) => ((m[p] = (m[p] || 0) + 1), m), {}))
        .sort((a, b) => b[0] - a[0]).map(([p, n]) => `<span class="plate-chip">${n} × ${fmtNum(+p)} kg</span>`).join('')
      : '';
    const out = document.getElementById('plateOut');
    if (!out) return;
    out.innerHTML = res.tooLight
      ? `<p class="muted">Leichter als die Stange (${fmtNum(bar)} kg).</p>`
      : `<div class="bar-vis" aria-hidden="true"><span class="bar-sleeve"></span>${plates}<span class="bar-collar"></span></div>
         <p class="plate-side">Pro Seite: <b>${fmtNum(res.perSide)} kg</b></p>
         <div class="plate-chips">${list || '<span class="muted">Nur die Stange</span>'}</div>
         ${res.rest ? `<p class="note">Mit Standardscheiben nicht exakt: ${fmtNum(res.rest)} kg fehlen (kleinste Scheibe ${fmtNum(PLATES[PLATES.length - 1])} kg).</p>` : ''}`;
    document.querySelectorAll('[data-action="bar"]').forEach((b) => b.classList.toggle('on', +b.dataset.kg === bar));
  };
  openSheet(`<h2 class="sheet-title">Scheibenrechner</h2>
    <label class="field plate-field"><input id="plateKg" inputmode="decimal" value="${fmtNum(total)}" autocomplete="off" data-input="plateKg"><span>kg</span></label>
    <div class="bar-pick"><span class="muted small">Stange</span><div class="seg-wrap" role="group" aria-label="Gewicht der Stange">
      ${[20, 15, 10].map((kg) => `<button class="seg-item" data-action="bar" data-kg="${kg}">${kg} kg</button>`).join('')}
    </div></div>
    <div id="plateOut"></div>`, {
    bar: (el) => { data.settings.bar = +el.dataset.kg; save(); draw(); },
    inputs: {
      plateKg: (el) => { const v = parseNum(el.value); if (v && !Number.isNaN(v)) { total = v; draw(); } },
    },
  });
  draw();
}

