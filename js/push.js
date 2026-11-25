// =============================================================
// push.js – Mitteilung am Pausenende, wenn die App im Hintergrund ist
//
// iOS hält Web-Apps im Hintergrund an. Darum übernimmt ein kleiner
// Server (push-server/, Cloudflare Worker) den Wecker:
//   App verlässt den Bildschirm während einer Pause → Server bekommt
//   Endzeit + Text → schickt zur Endzeit eine Push-Nachricht.
//   App kommt vorher zurück → Wecker wird gelöscht (dann piept die App selbst).
//
// Voraussetzungen iPhone: iOS 16.4+, App vom Home-Bildschirm gestartet,
// Mitteilungen erlaubt.
// =============================================================

import { PUSH_SERVER, VAPID_PUBLIC } from './push-config.js';

const KEY = 'gym.push';
const PENDING = 'gym.push.pending'; // Endzeit einer bestellten Mitteilung (überlebt Neustart der App)

export const configured = () => !!(PUSH_SERVER && VAPID_PUBLIC);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function stored() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

/** 'on' | 'off' | 'denied' | 'unsupported' | 'not-installed' | 'not-configured' */
export function status() {
  if (!configured()) return 'not-configured';
  if (!supported()) return standalone() ? 'unsupported' : 'not-installed';
  if (Notification.permission === 'denied') return 'denied';
  return stored()?.sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const keyBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Einschalten (muss aus einem Tipp heraus aufgerufen werden). */
export async function enable() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Mitteilungen sind blockiert – in den iPhone-Einstellungen für „Gym“ erlauben.' : 'Mitteilungen nicht erlaubt.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
  localStorage.setItem(KEY, JSON.stringify({ sub: sub.toJSON() }));
  return true;
}

export async function disable() {
  await cancelRestPush();
  localStorage.removeItem(KEY);
  try { (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.unsubscribe(); } catch { /* egal */ }
}

function post(path, body) {
  // keepalive: Anfrage geht auch raus, wenn iOS die App gerade in den Hintergrund schickt
  return fetch(PUSH_SERVER.replace(/\/$/, '') + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
  });
}

/** Mitteilung zur Zeit "at" (ms) bestellen. */
export async function scheduleRestPush(at, title, body) {
  const s = stored();
  if (status() !== 'on' || !s?.sub) return false;
  try {
    // Vorher merken: iOS friert die App evtl. ein, bevor die Antwort ankommt
    localStorage.setItem(PENDING, String(at));
    const res = await post('/schedule', { sub: s.sub, at, title, body });
    if (!res.ok) throw new Error(`Server: ${res.status}`);
    return true;
  } catch (e) {
    console.warn('Push konnte nicht bestellt werden', e);
    return false;
  }
}

/** Bestellte Mitteilung abbestellen (App ist wieder sichtbar / Pause vorbei). */
export async function cancelRestPush() {
  const s = stored();
  const at = Number(localStorage.getItem(PENDING));
  localStorage.removeItem(PENDING);
  if (!s?.sub || !at || at < Date.now()) return;
  try { await post('/cancel', { endpoint: s.sub.endpoint }); } catch { /* offline: Mitteilung kommt dann eben */ }
}

/** Letzte Zustellung laut Server: { status, text, at } – zur Fehlersuche. */
export async function lastDelivery() {
  const s = stored();
  if (!s?.sub) return null;
  const res = await fetch(PUSH_SERVER.replace(/\/$/, '') + '/last', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.sub.endpoint }),
  });
  return res.json();
}

/** Diagnose als Text (für die Einstellungen). */
export function diagnose() {
  const s = stored();
  return [
    `Status: ${status()}`,
    `Home-Bildschirm-App: ${standalone() ? 'ja' : 'nein'}`,
    `Erlaubnis: ${'Notification' in window ? Notification.permission : 'fehlt'}`,
    `Abo: ${s?.sub?.endpoint ? new URL(s.sub.endpoint).host : 'keins'}`,
  ].join(' · ');
}
