// =============================================================
// suppui.js – Supplement-Karte im Tab „Ernährung“ + Fenster
//
// Karte: heute fällige Supplements zum Abhaken (mit Uhrzeit, Menge,
// Hinweis und i-Knopf für Tipps). „Verwalten“ öffnet die Liste,
// dort anlegen/ändern/löschen.
// =============================================================

import { render, openSheet, closeSheet, toast, ask, ui } from '../app.js';
import { esc, dateStr } from '../util.js';
import { ICON } from './icons.js';
import { CATALOG, HINTS, catalogFor, tipsFor, supps, dueOn, isDone, toggleDone, saveSupp, deleteSupp, repText, syncSupps } from '../supps.js';
import { status as pushStatus, enable as enablePush } from '../push.js';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Hinweis, falls keine Mitteilungen ankommen können. */
export function pushNote() {
  const st = pushStatus();
  if (st === 'on' || st === 'not-configured') return '';
  const text = {
    off: 'Mitteilungen sind aus – ohne sie kommt keine Erinnerung.',
    denied: 'Mitteilungen sind blockiert. In den Handy-Einstellungen für „Gym“ erlauben.',
    'not-installed': 'Erinnerungen gehen nur, wenn die App auf dem Home-Bildschirm ist (Teilen → „Zum Home-Bildschirm“).',
    unsupported: 'Dieses Gerät unterstützt keine Mitteilungen.',
  }[st];
  return `<div class="supp-note">${ICON.bell}<span>${text}</span>${st === 'off' ? '<button class="chip" data-action="suppPush">Einschalten</button>' : ''}</div>`;
}

/** Karte im Ernährungs-Tab (ds = angezeigter Tag). */
export function suppCard(ds = dateStr()) {
  const all = supps();
  if (!all.length) {
    return `<section class="card supp-card">
      <div class="card-head"><h2>Supplements</h2></div>
      <p class="muted small">Erinnerung für Kreatin, Vitamin D & Co. – zur gewünschten Uhrzeit, auf Wunsch stündlich bis zum Abhaken.</p>
      <button class="btn big full" data-action="suppNew">${ICON.plus} Erinnerung anlegen</button>
    </section>`;
  }
  const due = dueOn(ds);
  const rows = due.map((s) => {
    const done = isDone(s.id, ds);
    return `<div class="supp-row${done ? ' done' : ''}">
      <button class="supp-check" data-action="suppToggle" data-id="${esc(s.id)}" role="checkbox" aria-checked="${done}" aria-label="${esc(s.name)} ${done ? 'genommen' : 'abhaken'}">${done ? ICON.check : ''}</button>
      <button class="supp-main" data-action="suppEdit" data-id="${esc(s.id)}">
        <span class="lr-title">${esc(s.name)}${s.dose ? ` <span class="muted">· ${esc(s.dose)}</span>` : ''}</span>
        <span class="lr-sub">${s.time} Uhr${s.hint ? ` · ${esc(s.hint)}` : ''}${s.nag ? ` · ${ICON.bell}` : ''}</span>
      </button>
      <button class="glass-circle sm" data-action="suppInfo" data-id="${esc(s.id)}" aria-label="Tipps zu ${esc(s.name)}">${ICON.info}</button>
    </div>`;
  }).join('');
  const n = due.filter((s) => isDone(s.id, ds)).length;
  return `<section class="card supp-card">
    <div class="card-head"><h2>Supplements</h2><span class="supp-count muted small">${due.length ? `${n}/${due.length}` : ''}</span><button class="chip" data-action="suppList">Verwalten</button></div>
    ${rows || `<p class="muted small">${ds === dateStr() ? 'Heute' : 'An diesem Tag'} steht nichts an.</p>`}
    ${pushNote()}
  </section>`;
}

/** Aktionen für den Ernährungs-Screen. */
export const suppActions = {
  suppNew: () => openSuppEdit(null),
  suppList: () => openSuppList(),
  suppEdit: (el) => openSuppEdit(supps().find((s) => s.id === el.dataset.id)),
  suppInfo: (el) => openSuppTips(supps().find((s) => s.id === el.dataset.id)?.name),
  suppToggle: (el) => {
    const ds = ui.params?.date || dateStr();
    const done = toggleDone(el.dataset.id, ds);
    if (done) navigator.vibrate?.(10);
    render();
  },
  suppPush: async () => {
    try { await enablePush(); syncSupps(); toast('Mitteilungen an'); } catch (e) { toast(e.message); }
    render();
  },
};

/** Tipps-Fenster (wie das i bei den Übungen). */
export function openSuppTips(name) {
  const t = tipsFor(name);
  openSheet(`<h2 class="sheet-title">${esc(t.known?.name || name || 'Supplements')}</h2>
    ${t.tips.length ? `<h3 class="sheet-h">Was die Forschung sagt</h3><ol class="cue-list">${t.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`
      : '<p class="muted small sheet-sub">Zu diesem Mittel habe ich keine eigenen Tipps hinterlegt – die allgemeinen Regeln gelten trotzdem.</p>'}
    ${t.known ? `<h3 class="sheet-h">Üblich</h3><dl class="facts-list"><div><dt>Menge</dt><dd>${esc(t.known.dose)}</dd></div><div><dt>Zeitpunkt</dt><dd>${esc(t.known.hint)}</dd></div></dl>` : ''}
    <h3 class="sheet-h">Allgemein</h3>
    <ul class="tip-list">${t.general.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="source">Basis: ISSN-Positionspapiere (Kreatin, Protein, Koffein, Beta-Alanin), DGE, BfR-Höchstmengenvorschläge 2024 und BfR-Mitteilung zu Ashwagandha (2024), EFSA. Keine medizinische Beratung.</p>`);
}

function openSuppList() {
  const rows = supps().slice().sort((a, b) => a.time.localeCompare(b.time)).map((s) => `<button class="list-row" data-action="edit" data-id="${esc(s.id)}">
      <span class="lr-main"><span class="lr-title">${esc(s.name)}${s.dose ? ` · ${esc(s.dose)}` : ''}</span>
        <span class="lr-sub">${s.time} Uhr · ${repText(s)}${s.hint ? ` · ${esc(s.hint)}` : ''}${s.nag ? ' · stündlich bis abgehakt' : ''}</span></span>
      <span class="chev">${ICON.chev}</span></button>`).join('');
  openSheet(`<h2 class="sheet-title">Supplements</h2>
    <div class="list-card sheet-list-card">${rows}</div>
    <div class="sheet-actions"><button class="btn primary big" data-action="add">${ICON.plus} Neue Erinnerung</button></div>`, {
    edit: (el) => openSuppEdit(supps().find((s) => s.id === el.dataset.id)),
    add: () => openSuppEdit(null),
  });
}

/** Anlegen / ändern. */
export function openSuppEdit(item) {
  const st = item ? JSON.parse(JSON.stringify(item)) : { name: '', dose: '', time: '08:00', rep: { type: 'daily', days: [0, 1, 2, 3, 4, 5, 6], n: 2, start: dateStr() }, hint: '', nag: false };
  st.rep = { days: [0, 1, 2, 3, 4, 5, 6], n: 2, start: dateStr(), ...st.rep };
  const isNew = !item || !!item.__new;
  const touched = { dose: !!item, time: !!item, hint: !!item };

  const repBody = () => {
    if (st.rep.type === 'days') return `<div class="wd-chips">${WD.map((d, i) => `<button class="chip sec${st.rep.days.includes(i) ? ' on' : ''}" data-action="wd" data-i="${i}" aria-pressed="${st.rep.days.includes(i)}">${d}</button>`).join('')}</div>`;
    if (st.rep.type === 'every') return `<label class="gfield inline"><span>alle … Tage</span><input id="sN" inputmode="numeric" value="${st.rep.n}" data-input="sN"></label>`;
    if (st.rep.type === 'once') return `<label class="gfield inline"><span>am</span><input id="sDate" type="date" value="${st.rep.start}" data-input="sDate"></label>`;
    return '';
  };
  const hintChips = () => HINTS.map((h) => `<button class="chip sec${st.hint === h ? ' on' : ''}" data-action="hint" data-h="${esc(h)}">${esc(h)}</button>`).join('');
  const tipsBox = () => {
    const c = catalogFor(st.name);
    return c ? `<button class="supp-tipline" data-action="tips">${ICON.info}<span><b>Tipps zu ${esc(c.name)}</b> · üblich ${esc(c.dose)}, ${esc(c.hint)}</span><span class="chev">${ICON.chev}</span></button>` : '';
  };
  const redraw = (part) => {
    const map = { rep: ['repBody', repBody], hints: ['hintChips', hintChips], tips: ['tipsBox', tipsBox] };
    const [id, fn] = map[part];
    const el = document.getElementById(id);
    if (el) el.innerHTML = fn();
  };
  const segRep = () => document.querySelectorAll('[data-action=rep]').forEach((b) => b.classList.toggle('on', b.dataset.t === st.rep.type));

  openSheet(`<h2 class="sheet-title">${isNew ? 'Neue Erinnerung' : 'Erinnerung ändern'}</h2>
    <div class="supp-form">
      <label class="gfield"><span>Supplement</span><input id="sName" list="suppNames" value="${esc(st.name)}" placeholder="z. B. Kreatin" maxlength="40" autocomplete="off" data-input="sName"></label>
      <datalist id="suppNames">${CATALOG.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>
      <div id="tipsBox">${tipsBox()}</div>
      <div class="two">
        <label class="gfield"><span>Menge</span><input id="sDose" value="${esc(st.dose)}" placeholder="z. B. 5 g" maxlength="30" autocomplete="off" data-input="sDose"></label>
        <label class="gfield"><span>Uhrzeit</span><input id="sTime" type="time" value="${st.time}" data-input="sTime"></label>
      </div>
      <h3 class="sheet-h">Wiederholen</h3>
      <div class="seg-wrap seg-wrap4" role="group" aria-label="Wiederholung">
        ${[['daily', 'Täglich'], ['days', 'Wochentage'], ['every', 'Alle X Tage'], ['once', 'Einmal']].map(([t, l]) => `<button class="seg-item${st.rep.type === t ? ' on' : ''}" data-action="rep" data-t="${t}">${l}</button>`).join('')}
      </div>
      <div id="repBody">${repBody()}</div>
      <h3 class="sheet-h">Hinweis</h3>
      <div class="hint-chips" id="hintChips">${hintChips()}</div>
      <label class="gfield"><span>Eigener Hinweis</span><input id="sHint" value="${HINTS.includes(st.hint) ? '' : esc(st.hint)}" placeholder="z. B. mit Orangensaft" maxlength="60" autocomplete="off" data-input="sHint"></label>
      <button class="switch-row" data-action="nag" role="switch" aria-checked="${st.nag}">
        <span><b>Stündlich nachfragen</b><span class="muted small">Nach der ersten Erinnerung jede Stunde erneut, bis du abhakst (bis Mitternacht).</span></span>
        <i class="switch${st.nag ? ' on' : ''}"></i>
      </button>
    </div>
    <div class="sheet-actions">
      <button class="btn primary big" data-action="save">Speichern</button>
      ${!isNew ? `<button class="btn ghost big danger" data-action="del">${ICON.trash} Löschen</button>` : ''}
    </div>`, {
    rep: (el) => { st.rep.type = el.dataset.t; segRep(); redraw('rep'); },
    wd: (el) => {
      const i = +el.dataset.i;
      st.rep.days = st.rep.days.includes(i) ? st.rep.days.filter((d) => d !== i) : [...st.rep.days, i].sort();
      redraw('rep');
    },
    hint: (el) => {
      st.hint = st.hint === el.dataset.h ? '' : el.dataset.h;
      touched.hint = true;
      const own = document.getElementById('sHint'); if (own) own.value = '';
      redraw('hints');
    },
    nag: (el) => { st.nag = !st.nag; el.setAttribute('aria-checked', st.nag); el.querySelector('.switch').classList.toggle('on', st.nag); },
    tips: () => {
      // Tipps öffnen, danach zurück zur Eingabe (Stand bleibt erhalten)
      const back = { ...st, rep: { ...st.rep } };
      openSuppTips(st.name);
      const bar = document.querySelector('#sheet .sheet-bar');
      if (bar) {
        const b = document.createElement('button');
        b.className = 'chip supp-back'; b.textContent = 'Zurück zur Eingabe';
        b.addEventListener('click', (e) => { e.stopPropagation(); openSuppEdit({ ...back, id: item?.id, __new: isNew }); });
        document.querySelector('#sheet .sheet-panel').append(b);
      }
    },
    save: () => {
      const name = st.name.trim();
      if (!name) return toast('Name eingeben, z. B. Kreatin');
      if (!/^\d{2}:\d{2}$/.test(st.time)) return toast('Uhrzeit wählen');
      if (st.rep.type === 'days' && !st.rep.days.length) return toast('Mindestens einen Wochentag wählen');
      const rep = { type: st.rep.type, start: st.rep.type === 'once' ? st.rep.start : (item?.rep?.start || dateStr()) };
      if (st.rep.type === 'days') rep.days = st.rep.days;
      if (st.rep.type === 'every') rep.n = Math.max(1, Math.min(60, parseInt(st.rep.n, 10) || 1));
      saveSupp({ id: isNew ? undefined : item.id, name, dose: st.dose.trim(), time: st.time, rep, hint: st.hint.trim(), nag: st.nag });
      closeSheet();
      render();
      toast(pushStatus() === 'on' ? `Erinnerung um ${st.time} Uhr gespeichert` : 'Gespeichert – Mitteilungen einschalten, damit sie kommt');
    },
    del: async () => {
      if (!(await ask('Erinnerung löschen?', `${st.name} wird nicht mehr erinnert.`, 'Löschen', true))) return;
      deleteSupp(item.id);
      closeSheet();
      render();
    },
    inputs: {
      sName: (el) => {
        st.name = el.value;
        const c = catalogFor(st.name);
        if (c) {
          // Vorschläge übernehmen, solange der Nutzer die Felder nicht selbst geändert hat
          if (!touched.dose) { st.dose = c.dose; document.getElementById('sDose').value = c.dose; }
          if (!touched.time) { st.time = c.time; document.getElementById('sTime').value = c.time; }
          if (!touched.hint) { st.hint = c.hint; redraw('hints'); }
        }
        redraw('tips');
      },
      sDose: (el) => { st.dose = el.value; touched.dose = true; },
      sTime: (el) => { st.time = el.value; touched.time = true; },
      sHint: (el) => { st.hint = el.value; touched.hint = true; redraw('hints'); },
      sN: (el) => { st.rep.n = el.value; },
      sDate: (el) => { st.rep.start = el.value || dateStr(); },
    },
  });
  if (!item) setTimeout(() => document.getElementById('sName')?.focus(), 350);
}
