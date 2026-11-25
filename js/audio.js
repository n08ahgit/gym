// =============================================================
// audio.js – Ton am Pausenende über Web Audio
//
// iOS erlaubt Ton erst nach einer Nutzer-Berührung. Deshalb wird der
// AudioContext bei jedem Tippen (falls nötig) erzeugt bzw. fortgesetzt.
// Hinweis: Steht das iPhone auf lautlos, ist Web Audio stumm.
// =============================================================

let ctx = null;

/** Bei jeder Berührung aufrufen (app.js macht das global). */
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    // Ein stiller Mini-Ton "entsperrt" Audio auf iOS
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

/** Drei kurze Töne, der letzte höher. */
export function beep() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  [[0, 880], [0.28, 880], [0.56, 1320]].forEach(([dt, freq]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = t0 + dt;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}
