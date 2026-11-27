// =============================================================
// cheer.js – Banner „Noah feuert dich an 💪“
//
// Kommt per Push (App zu: Mitteilung; App offen: zusätzlich dieses Banner)
// oder wird beim Öffnen abgeholt, falls die Mitteilung nicht ankam.
// Jede Nachricht erscheint nur einmal (gemerkte IDs).
// =============================================================

import { esc } from './util.js';

const SHOWN = 'gym.cheersShown';
const shown = () => { try { return JSON.parse(localStorage.getItem(SHOWN) || '[]'); } catch { return []; } };
const remember = (id) => { try { localStorage.setItem(SHOWN, JSON.stringify([...shown(), id].slice(-60))); } catch { /* egal */ } };

const queue = [];
let busy = false;

export function showCheer(c) {
  if (!c?.id || shown().includes(c.id)) return;
  remember(c.id);
  queue.push(c);
  if (!busy) next();
}

function next() {
  const c = queue.shift();
  if (!c) { busy = false; return; }
  busy = true;
  const el = document.createElement('div');
  el.className = 'cheer';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="cheer-ic" aria-hidden="true">💪</span>
    <span class="cheer-tx"><b>${esc(c.name || 'Ein Freund')} feuert dich an</b><span>${esc(c.text || 'Gib alles – du schaffst das!')}</span></span>`;
  document.body.appendChild(el);
  navigator.vibrate?.([30, 60, 30]);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const close = () => { el.classList.remove('in'); setTimeout(() => { el.remove(); next(); }, 300); };
  el.addEventListener('click', close);
  setTimeout(close, 6000);
}
