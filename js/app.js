// =============================================================
// app.js – Einstieg: Router, Ereignisse, Overlays, Timer-Takt, Wake Lock
//
// Aufbau:
// - Jeder Screen (screens/*.js) exportiert ein Objekt mit
//     render(params) -> HTML-String
//     after(root, params)   optional, nach dem Einfügen ins DOM
//     actions: { name(el, event) }   für Elemente mit data-action="name"
//     inputs:  { name(el, event) }   für Felder mit data-input="name"
// - Klicks werden zentral abgefangen (Event-Delegation) und an die
//   Aktionen des offenen Overlays bzw. des aktiven Screens verteilt.
// =============================================================

import { unlockAudio } from './audio.js';
import { esc, APP_VERSION } from './util.js';
import { ICON } from './screens/icons.js';
import { homeScreen } from './screens/home.js';
import { editScreen, searchScreen, customScreen } from './screens/plan.js';
import { workoutScreen, workoutTick, hasActive } from './screens/workout.js';
import { settingsScreen } from './screens/settings.js';
import { progressScreen, exstatScreen } from './screens/progress.js';
import { friendsScreen, addFromCode } from './screens/friends.js';
import { yearScreen } from './screens/yearview.js';
import { foodScreen } from './screens/food.js';
import { sessionScreen } from './screens/sessionedit.js';
import { autoBackup, requestPersist } from './backup.js';

const screens = {
  home: homeScreen,
  edit: editScreen,
  search: searchScreen,
  custom: customScreen,
  workout: workoutScreen,
  settings: settingsScreen,
  progress: progressScreen,
  exstat: exstatScreen,
  friends: friendsScreen,
  year: yearScreen,
  food: foodScreen,
  session: sessionScreen,
};

/** Aktionen, die auf jedem Screen gelten (z. B. Tab-Leiste). */
const globalActions = {
  tab: (el) => { if (el.dataset.tab !== ui.screen) go(el.dataset.tab); },
};

/** Aktueller Screen + Parameter. */
export const ui = { screen: 'home', params: {} };

const appEl = document.getElementById('app');
const sheetEl = document.getElementById('sheet');
const modalEl = document.getElementById('modal');
let sheetActions = null;
let modalActions = null;

// ---------- Navigation ----------

/** Tiefe je Screen. Tabs (Tiefe 0) blenden über; tiefer = öffnet sich aus dem
 *  angetippten Element, flacher = schrumpft dorthin zurück. */
const DEPTH = { home: 0, progress: 0, food: 0, friends: 0, settings: 0, edit: 1, workout: 1, exstat: 1, year: 1, session: 2, search: 2, custom: 3 };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let skipNextTransition = false;

/**
 * DOM-Änderung als View Transition ausführen (Safari 18+, Chrome 111+).
 * dir: 'forward' | 'back' | 'fade'. Ohne Unterstützung: sofort.
 */
export function transition(update, dir = 'fade') {
  if (!document.startViewTransition || skipNextTransition) {
    skipNextTransition = false;
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = reduceMotion() ? 'fade' : dir;
  const vt = document.startViewTransition(update);
  // Ein schneller zweiter Tipp bricht den laufenden Übergang ab – das ist ok, kein Fehler.
  vt.ready.catch(() => {});
  vt.finished.catch(() => {}).finally(() => delete root.dataset.nav);
}

// ---------- Öffnen aus dem angetippten Element ----------
// Bei jedem Antippen merken wir uns, wo das Element liegt. Öffnet sich daraus
// ein Fenster/Bildschirm, wächst es aus genau dieser Stelle heraus – und beim
// Schließen schrumpft es dorthin zurück (räumliche Konsistenz, wie iOS-Zoom).
let lastTap = null;        // { rect, t }
let sheetOrigin = null;    // Element-Rechteck, aus dem das offene Sheet kam
const originFor = {};      // Screen -> Rechteck (mit Scroll-Position), aus dem er kam

function freshTap() {
  return lastTap && performance.now() - lastTap.t < 800 ? lastTap.rect : null;
}

/** Rechteck als Abstände zum Bildschirmrand (für clip-path inset). */
function setOriginVars(r) {
  const s = document.documentElement.style;
  s.setProperty('--o-t', `${Math.max(0, r.top)}px`);
  s.setProperty('--o-l', `${Math.max(0, r.left)}px`);
  s.setProperty('--o-r', `${Math.max(0, innerWidth - r.right)}px`);
  s.setProperty('--o-b', `${Math.max(0, innerHeight - r.bottom)}px`);
}

/** Verlauf der tieferen Bildschirme: daraus wird beim Wisch-Zurück der
 *  vorherige Bildschirm schon während des Wischens darunter gezeichnet. */
const backStack = [];

export function go(screen, params = {}) {
  if (updateWaiting && screen === 'home' && !hasActive()) { applyUpdate(); return; }
  const from = ui.screen;
  if (DEPTH[screen] > DEPTH[from]) backStack.push({ screen: from, params: { ...ui.params } });
  else if (DEPTH[screen] < DEPTH[from]) while (backStack.length && DEPTH[backStack[backStack.length - 1].screen] >= DEPTH[screen]) backStack.pop();
  if (DEPTH[screen] === 0) backStack.length = 0;
  // Kam der Tipp aus einem Sheet, wächst der neue Screen aus dem Element, das das Sheet geöffnet hat
  const tapRect = !sheetEl.hidden && sheetOrigin ? sheetOrigin : freshTap();
  closeSheet(true);
  let dir = 'fade';
  if (DEPTH[screen] > DEPTH[from]) {
    if (tapRect) {
      dir = 'zoom';
      setOriginVars(tapRect);
      originFor[screen] = { top: tapRect.top + scrollY, left: tapRect.left, right: tapRect.right, bottom: tapRect.bottom + scrollY, from };
    } else dir = 'forward';
  } else if (DEPTH[screen] < DEPTH[from]) {
    const o = originFor[from];
    delete originFor[from];
    // Zurück: nur in die Herkunft schrumpfen, wenn sie oben auf dem Zielbildschirm sichtbar ist
    if (o && o.from === screen && o.bottom < innerHeight) {
      dir = 'unzoom';
      setOriginVars(o);
    } else dir = 'back';
  }
  transition(() => {
    ui.screen = screen;
    ui.params = params;
    render();
    window.scrollTo(0, 0);
  }, dir);
}

export function render() {
  const s = screens[ui.screen];
  appEl.innerHTML = s.render(ui.params);
  appEl.dataset.screen = ui.screen;
  s.after?.(appEl, ui.params);
  syncWakeLock();
  syncBackGuard();
}

// ---------- Android: Zurück-Taste / Zurück-Geste ----------
// Ohne das würde "Zurück" die App sofort schließen. So gilt wie bei
// nativen Android-Apps: Zurück schließt erst den Dialog, dann das
// Fenster, dann den Unterbildschirm, dann geht es zum Start-Tab –
// erst auf dem Start-Tab beendet Zurück die App.
// (Nur Android: Auf dem iPhone gibt es keine Zurück-Taste, dort wischt man.)
const ANDROID = /Android/i.test(navigator.userAgent);
let ignorePop = false;
const needGuard = () => !sheetEl.hidden || !modalEl.hidden || ui.screen !== 'home';
export function syncBackGuard() {
  if (!ANDROID) return;
  const has = !!history.state?.gymGuard;
  if (needGuard() && !has) history.pushState({ gymGuard: 1 }, '');
  else if (!needGuard() && has) { ignorePop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (!ANDROID) return;
  if (ignorePop) { ignorePop = false; return; }
  if (!modalEl.hidden) modalActions?.modalCancel?.();
  else if (!sheetEl.hidden) closeSheet();
  else if (BACK_ACTION[ui.screen]) screens[ui.screen].actions?.[BACK_ACTION[ui.screen]]?.();
  else if (ui.screen !== 'home') go('home');
  setTimeout(syncBackGuard, 350);
});

// ---------- Bottom-Sheet & Dialog ----------

/** Bottom-Sheet öffnen. actions: Handler für data-action innerhalb. */
let sheetToken = 0;
export function openSheet(html, actions = {}) {
  sheetToken++;
  sheetActions = actions;
  sheetEl.classList.remove('closing');
  sheetEl.innerHTML = `<div class="backdrop" data-action="closeSheet"></div>
    <div class="sheet-panel" role="dialog" aria-modal="true"><div class="grabber" aria-hidden="true"></div>
      <div class="sheet-bar"><button class="glass-circle" data-action="closeSheet" aria-label="Schließen">${ICON.x}</button></div>${html}</div>`;
  // Titel in die Kopfzeile neben das X ziehen (wie iOS-Sheets)
  const t = sheetEl.querySelector('.sheet-panel > .sheet-title');
  if (t) sheetEl.querySelector('.sheet-bar').append(t);
  sheetEl.hidden = false;
  syncBackGuard();
  document.documentElement.classList.add('sheet-open');
  // Wischen auf dem abgedunkelten Hintergrund scrollt nie die Seite
  sheetEl.querySelector('.backdrop').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  const panel = sheetEl.querySelector('.sheet-panel');
  enableSwipeToClose(panel);
  sheetOrigin = freshTap();
  if (sheetOrigin && !reduceMotion() && panel.animate) {
    panel.classList.add('from-origin');
    panel.animate(originFrames(panel, sheetOrigin), { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
  }
}

/** Keyframes: Panel startet exakt auf dem Element (Position + Größe + Rundung) und wächst auf. */
function originFrames(panel, r) {
  const p = panel.getBoundingClientRect();
  const dy = r.top - p.top;
  const clipFrom = `inset(0px ${Math.max(0, p.right - r.right)}px ${Math.max(0, p.height - r.height)}px ${Math.max(0, r.left - p.left)}px round 16px)`;
  return [
    { transform: `translateY(${dy}px)`, clipPath: clipFrom, opacity: 0.85 },
    { transform: 'translateY(0px)', clipPath: 'inset(0px 0px 0px 0px round 22px)', opacity: 1 },
  ];
}

/**
 * Sheet schließen. Standard: gleitet nach unten weg (Ausgang schneller als
 * Eingang, gleicher Weg zurück). instant = sofort (z. B. bei Navigation).
 */
export function closeSheet(instant = false, viaSwipe = false) {
  if (sheetEl.hidden) return;
  sheetActions = null;
  const origin = sheetOrigin;
  sheetOrigin = null;
  const token = ++sheetToken;
  const finish = () => {
    if (token !== sheetToken) return; // inzwischen neues Sheet geöffnet
    sheetEl.hidden = true;
    sheetEl.classList.remove('closing');
    sheetEl.innerHTML = '';
    document.documentElement.classList.remove('sheet-open');
    syncBackGuard();
  };
  if (instant || reduceMotion()) return finish();
  const panel = sheetEl.querySelector('.sheet-panel');
  // Zurück in das Element, aus dem das Sheet kam (gleicher Weg zurück, schneller als hinein)
  if (origin && !viaSwipe && panel?.animate) {
    sheetEl.classList.add('closing', 'to-origin');
    panel.animate(originFrames(panel, origin).reverse(), { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
    setTimeout(() => { sheetEl.classList.remove('to-origin'); finish(); }, 300);
    return;
  }
  sheetEl.classList.add('closing');
  if (panel) panel.style.transform = '';
  setTimeout(finish, 240);
}

/**
 * Sheet nach unten wischen = schließen (HIG sheets.md).
 * Folgt dem Finger 1:1, nach oben gedämpft (Gummiband), schließt bei
 * genug Weg ODER genug Schwung (Geschwindigkeit, nicht nur Distanz).
 */
function enableSwipeToClose(panel) {
  let startY = null, startT = 0, dy = 0;
  panel.addEventListener('touchstart', (e) => {
    if (panel.scrollTop > 0 || e.touches.length > 1) return;
    startY = e.touches[0].clientY;
    startT = performance.now();
    dy = 0;
    panel.classList.add('dragging');
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const raw = e.touches[0].clientY - startY;
    // Kann das Fenster selbst nach oben scrollen, gehört die Geste ihm (Inhalt scrollen)
    if (raw < 0 && panel.scrollHeight > panel.clientHeight) { startY = null; panel.classList.remove('dragging'); panel.style.transform = ''; return; }
    dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2; // nach oben: Widerstand
    panel.style.transform = `translateY(${dy}px)`;
    e.preventDefault(); // die Seite dahinter darf nicht mitscrollen
  }, { passive: false });
  const end = () => {
    if (startY === null) return;
    startY = null;
    panel.classList.remove('dragging');
    const velocity = dy / (performance.now() - startT); // px pro ms
    if (dy > 120 || (dy > 20 && velocity > 0.11)) closeSheet(false, true);
    else panel.style.transform = '';
  };
  panel.addEventListener('touchend', end);
  panel.addEventListener('touchcancel', end);
}

/** Bestätigungsdialog. Liefert Promise<boolean>. */
export function ask(title, text, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    const done = (v) => {
      modalEl.hidden = true;
      modalEl.innerHTML = '';
      modalActions = null;
      resolve(v);
      setTimeout(syncBackGuard, 0);
    };
    modalActions = { modalOk: () => done(true), modalCancel: () => done(false) };
    modalEl.innerHTML = `<div class="backdrop" data-action="modalCancel"></div>
      <div class="modal-panel" role="alertdialog">
        <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
        <div class="modal-actions">
          <button class="btn" data-action="modalCancel">Abbrechen</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-action="modalOk">${esc(okLabel)}</button>
        </div></div>`;
    modalEl.hidden = false;
    syncBackGuard();
  });
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Ereignisse ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const name = el.dataset.action;
  let fn;
  if (!modalEl.hidden) fn = modalActions?.[name];
  else if (!sheetEl.hidden) fn = name === 'closeSheet' ? () => closeSheet() : sheetActions?.[name];
  else fn = screens[ui.screen].actions?.[name] || globalActions[name];
  if (fn) {
    lastTap = { rect: el.getBoundingClientRect(), t: performance.now() };
    e.preventDefault();
    fn(el, e);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const fn = (!sheetEl.hidden && sheetActions?.inputs?.[el.dataset.input]) || screens[ui.screen].inputs?.[el.dataset.input];
  fn?.(el, e);
});

// Enter in einem Feld mit data-enter="aktion" löst die Aktion aus
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('[data-enter]');
  if (!el) return;
  e.preventDefault();
  const fn = (!sheetEl.hidden && sheetActions?.[el.dataset.enter]) || screens[ui.screen].actions?.[el.dataset.enter];
  fn?.(el, e);
});

// ---------- Vom linken Rand wischen = zurück (wie in iOS-Apps) ----------
// Folgt dem Finger 1:1; zurück bei genug Weg oder Schwung, sonst federt es zurück.
const BACK_ACTION = { edit: 'back', search: 'back', custom: 'back', exstat: 'back', year: 'back', workout: 'home' };
let edge = null;
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (e.touches.length > 1 || !sheetEl.hidden || !modalEl.hidden || !BACK_ACTION[ui.screen] || t.clientX > 24) return;
  edge = { x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, locked: false };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!edge) return;
  const t = e.touches[0];
  const dx = t.clientX - edge.x, dy = t.clientY - edge.y;
  if (!edge.locked) {
    // ~10 px Schwelle, dann Richtung festlegen (vertikal = normales Scrollen)
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { edge = null; return; }
    // Noch unentschieden: Seite darf nicht anfangen zu scrollen
    if (e.cancelable) e.preventDefault();
    if (dx < 10) return;
    edge.locked = true;
    edge.scrollY = scrollY;
    document.documentElement.classList.add('edge-lock');
    appEl.classList.add('edge-dragging');
    edge.under = showUnder();
  }
  if (e.cancelable) e.preventDefault(); // Bildschirm eingefroren, kein Scrollen beim Schieben
  if (scrollY !== edge.scrollY) scrollTo(0, edge.scrollY);
  edge.dx = Math.max(0, dx);
  appEl.style.transform = `translateX(${edge.dx}px)`;
  moveUnder(edge.under, edge.dx / innerWidth, false);
}, { passive: false });

/** Vorherigen Bildschirm (aus dem Verlauf) als Ebene unter die App legen. */
function showUnder() {
  const target = backStack[backStack.length - 1] || { screen: 'home', params: {} };
  const el = document.createElement('div');
  el.className = 'under';
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  el.innerHTML = screens[target.screen].render(target.params);
  document.body.insertBefore(el, appEl);
  moveUnder(el, 0, false);
  return el;
}
/** p = 0 (verdeckt, leicht links und dunkel) … 1 (ganz sichtbar). */
function moveUnder(el, p, animate) {
  if (!el) return;
  el.style.transition = animate ? 'transform 220ms var(--ease-out), filter 220ms var(--ease-out)' : 'none';
  el.style.transform = `translateX(${-28 * (1 - p)}%)`;
  el.style.filter = `brightness(${0.55 + 0.45 * p})`;
}
function edgeEnd() {
  if (!edge) return;
  const { dx, t, locked, under } = edge;
  edge = null;
  if (!locked) return;
  appEl.classList.remove('edge-dragging');
  setTimeout(() => document.documentElement.classList.remove('edge-lock'), 230);
  const velocity = dx / (performance.now() - t);
  const commit = dx > innerWidth * 0.35 || (dx > 30 && velocity > 0.3);
  appEl.style.transform = commit ? 'translateX(100%)' : '';
  moveUnder(under, commit ? 1 : 0, true);
  setTimeout(() => {
    if (!commit) { under?.remove(); return; }
    appEl.classList.add('edge-dragging'); // ohne Animation zurücksetzen
    appEl.style.transform = '';
    void appEl.offsetWidth;
    appEl.classList.remove('edge-dragging');
    skipNextTransition = true; // der Wisch WAR schon die Animation
    screens[ui.screen].actions?.[BACK_ACTION[ui.screen]]?.();
    skipNextTransition = false;
    under?.remove(); // jetzt liegt der echte Bildschirm genau dort
  }, 220);
}
document.addEventListener('touchend', edgeEnd);
document.addEventListener('touchcancel', edgeEnd);

// ---------- Glas-Buttons: Aufleuchten an der Fingerstelle ----------
// Merkt die Fingerposition (--x/--y) und setzt .pressed, solange gedrückt.
// Mindestens 140 ms, damit auch ein kurzer Tipp sichtbar aufleuchtet.
const PRESSABLE = '.btn, .icon-btn.glass, .glass-circle, .glass-pill > button, .topbar .text-btn, .active-bar, .stepper button, .chip, .day, .tab, .list-row:not(.static), .seg-item, .more-toggle';
// Einsinken nur bei einem echten Tipp: erst nach 60 ms ohne Bewegung (sonst ist
// es Scrollen) oder spätestens beim Loslassen auf dem Element.
let press = null; // { el, x, y, timer, lit, at }
function light(p) {
  if (p.lit) return;
  p.lit = true;
  p.at = performance.now();
  p.el.classList.add('pressed');
}
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest(PRESSABLE);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--x', `${e.clientX - r.left}px`);
  el.style.setProperty('--y', `${e.clientY - r.top}px`);
  press = { el, x: e.clientX, y: e.clientY, lit: false, at: 0 };
  press.timer = setTimeout(() => press && press.el === el && light(press), 60);
}, { passive: true });
document.addEventListener('pointermove', (e) => {
  if (press && !press.lit && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress();
}, { passive: true });
function cancelPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press.el.classList.remove('pressed');
  press = null;
}
document.addEventListener('pointerup', (e) => {
  if (!press) return;
  const p = press;
  press = null;
  clearTimeout(p.timer);
  // Losgelassen auf dem Element = echter Tipp → kurz aufleuchten lassen
  if (p.el.contains(document.elementFromPoint(e.clientX, e.clientY)) || p.lit) {
    light(p);
    setTimeout(() => p.el.classList.remove('pressed'), Math.max(140, 160 - (performance.now() - p.at)));
  } else p.el.classList.remove('pressed');
}, { passive: true });
document.addEventListener('pointercancel', cancelPress, { passive: true });
window.addEventListener('scroll', cancelPress, { passive: true, capture: true });

// Audio bei jeder Berührung freischalten (iOS)
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('touchend', unlockAudio, { passive: true });

// ---------- Timer-Takt ----------
// Zeiten werden immer aus Zeitstempeln berechnet; der Takt aktualisiert
// nur die Anzeige. Pausiert iOS das JavaScript, stimmt die Zeit danach trotzdem.
setInterval(workoutTick, 250);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    workoutTick();
    syncWakeLock();
  }
});

// ---------- Screen Wake Lock (Bildschirm bleibt während Workout an) ----------

let wakeLock = null;
export async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (hasActive() && document.visibilityState === 'visible') {
      if (!wakeLock || wakeLock.released) wakeLock = await navigator.wakeLock.request('screen');
    } else if (wakeLock && !wakeLock.released) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* z. B. Energiesparmodus – dann eben ohne */
  }
}

// ---------- Start ----------

// ---------- Updates für alle ----------
// Neue Version auf GitHub (CACHE in sw.js hochgezählt) → beim Öffnen oder
// Zurückkehren in die App wird sie gefunden, installiert und geladen.
// Läuft gerade ein Workout, wird erst danach neu geladen (Daten bleiben immer erhalten).
let updateWaiting = false;
function applyUpdate() {
  try { sessionStorage.setItem('gym.updated', '1'); } catch { /* egal */ }
  location.reload();
}
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; } // erste Installation, kein Update
    if (hasActive()) { updateWaiting = true; toast('Update geladen – wird nach dem Workout aktiv'); } else applyUpdate();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const check = () => reg?.update?.().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch((e) => console.warn('SW-Registrierung fehlgeschlagen', e));
}
try {
  if (sessionStorage.getItem('gym.updated')) {
    sessionStorage.removeItem('gym.updated');
    setTimeout(() => toast(`Aktualisiert auf Version ${APP_VERSION}`), 600);
  }
} catch { /* egal */ }


// Demo (demo.html): leere App einmalig mit Beispieldaten füllen
if (window.GYM_DEMO) {
  const { data, importJSON } = await import('./store.js');
  if (!data.planVersions.length && !data.sessions.length) {
    const { buildDemoData } = await import('./demo.js');
    importJSON(JSON.stringify(buildDemoData()));
  }
}

// Automatische Sicherung beim Start (ein Schnappschuss pro Tag)
requestPersist();
autoBackup();

// Freundes-Link geöffnet (…/f/K7Q2MX oder alt …#f=…)? → Freund übernehmen, Rangliste zeigen
let startScreen = hasActive() ? 'workout' : 'home';
const qs = new URLSearchParams(location.search);
const invite = location.pathname.match(/\/f\/([A-Za-z2-9]{6})\/?$/)?.[1] || (/^[A-Za-z2-9]{6}$/.test(qs.get('f') || '') ? qs.get('f') : null)
  || (location.hash.startsWith('#f=') ? location.hash : null);
if (invite) {
  qs.delete('f');
  history.replaceState(null, '', location.pathname.replace(/f\/[A-Za-z2-9]{6}\/?$/, '') + (qs.toString() ? `?${qs}` : ''));
  addFromCode(invite).then((ok) => { if (ok && !hasActive()) go('friends'); }).catch((e) => toast(e.message));
}
window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#f=')) return;
  const h = location.hash;
  history.replaceState(null, '', location.pathname + location.search);
  addFromCode(h).then((ok) => { if (ok) go('friends'); }).catch((e) => toast(e.message));
});

// Eigenen Stand für Freunde aktuell halten (wenn ein Name gesetzt ist)
import('./friends.js').then(async (f) => {
  await f.publishMe();
  f.refreshFriends(); // alte Freunde umstellen, gegenseitig hinzufügen, Stände holen
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') f.publishMe(); });
});

// Supplement-Erinnerungen: Server aktuell halten, am Handy Abgehaktes übernehmen
import('./supps.js').then((sp) => {
  if (!sp.supps().length) return;
  sp.syncSupps();
  const pull = () => sp.pullSuppDone().then((ch) => { if (ch && ui.screen === 'food') render(); });
  pull();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
});
// Mitteilung „Kreatin nehmen“ angetippt → Ernährung öffnen
if (qs.get('tab') === 'food' && !hasActive()) {
  startScreen = 'food';
  history.replaceState(null, '', location.pathname + '?app');
}
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.go === 'food' && !hasActive()) go('food'); });

// Läuft ein Workout, direkt dorthin (z. B. nach Schließen der App)
go(startScreen);
