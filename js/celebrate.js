// =============================================================
// celebrate.js – kurzer Vollbild-Moment nach dem Speichern, wenn die
// Streak steigt: Flamme lodert auf, Zahl zählt hoch, Meilenstein/neue
// Stufe/Schutz werden genannt. Antippen schließt sofort (nie blockieren).
// =============================================================

import { flameSvg } from './streak.js';
import { unlockAudio, beep } from './audio.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function showCelebration({ from, to, milestone, newTier, newFreeze, tier, next }) {
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Streak: ${to} Tage`);
  const lines = [];
  if (milestone) lines.push(`<b>Meilenstein: ${milestone} Tage!</b>`);
  if (newTier) lines.push(`Neue Stufe: <b>${newTier}</b>`);
  if (newFreeze) lines.push('Du hast einen <b>Streak-Schutz</b> verdient.');
  if (!lines.length) lines.push(`Noch ${next - to} ${next - to === 1 ? 'Tag' : 'Tage'} bis ${next}.`);
  el.innerHTML = `
    <div class="cel-glow t${tier}"></div>
    <div class="cel-body">
      <div class="cel-flame">${flameSvg(tier, { size: 150, id: 'cf' })}</div>
      <div class="cel-count"><span id="celNum">${from}</span></div>
      <div class="cel-title">${to === 1 ? 'Tag' : 'Tage'} Streak</div>
      <p class="cel-lines">${lines.join('<br>')}</p>
      <button class="btn primary big cel-btn">Weiter</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));

  // Zahl hochzählen (kurz, mit ease-out)
  const num = el.querySelector('#celNum');
  const t0 = performance.now(), dur = reduce() ? 0 : 900;
  const step = (t) => {
    const k = dur ? Math.min(1, (t - t0) / dur) : 1;
    const e = 1 - Math.pow(1 - k, 3);
    num.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
    else el.classList.add('done');
  };
  setTimeout(() => requestAnimationFrame(step), reduce() ? 0 : 450);
  try { unlockAudio(); if (milestone) beep(); } catch { /* ohne Ton */ }

  const close = () => {
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), reduce() ? 0 : 260);
  };
  el.addEventListener('click', close);
}
