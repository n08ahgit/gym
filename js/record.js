// =============================================================
// record.js – dezenter Hinweis bei neuem Rekord
//
// Kein Konfetti: eine ruhige Karte gleitet oben herein, ein feiner
// Lichtschein läuft einmal darüber, nach 4 s verschwindet sie wieder
// (antippen schließt sofort). Ein kurzer Ton, falls Ton an ist.
// =============================================================

import { esc, fmtNum, fmtWU, units } from './util.js';
import { ICON } from './screens/icons.js';

let current = null;

export function showRecord({ name, w, r, kind, value, gain, u }) {
  const fmtW = (kg) => fmtWU(kg, u || units.w);
  current?.remove();
  const el = document.createElement('div');
  el.className = 'record';
  el.setAttribute('role', 'status');
  const detail = kind === 'e1rm'
    ? `${fmtW(w)} × ${fmtNum(r)} · geschätztes Maximum ${fmtW(value)} <span class="rec-gain">+${fmtW(gain)}</span>`
    : `${fmtW(w)} – so schwer wie noch nie <span class="rec-gain">+${fmtW(gain)}</span>`;
  el.innerHTML = `<span class="rec-icon">${ICON.award}</span>
    <span class="rec-text"><span class="rec-title">Neuer Rekord · ${esc(name)}</span><span class="rec-detail">${detail}</span></span>`;
  document.body.appendChild(el);
  current = el;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const close = () => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 320);
    if (current === el) current = null;
  };
  el.addEventListener('click', close);
  setTimeout(close, 4200);
}
