// =============================================================
// scan.js – KI-Kalorien-Scan: Guthaben-Code, Zustimmung, Foto vorbereiten, Kauf
//
// Guthaben liegt nur auf dem Server. Das Gerät kennt nur den Kauf-Code
// (20 Zeichen, data.wallet.code) – er wird mit dem Konto auf alle Geräte
// übertragen und steht in der Kauf-Bestätigung (Wiederherstellung).
// Fotos werden im Gerät verkleinert und neu kodiert (entfernt EXIF/GPS),
// nur für den Scan an den Server geschickt und nirgends gespeichert.
// =============================================================

import { data, save } from './store.js';
import { PUSH_SERVER } from './push-config.js';
import { searchLocal } from './nutrition.js';

const API = () => (PUSH_SERVER || '').replace(/\/$/, '');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z2-9]{20}$/;

export function walletCode() {
  if (!CODE_RE.test(data.wallet?.code || '')) {
    const r = crypto.getRandomValues(new Uint8Array(20));
    data.wallet = { code: Array.from(r, (x) => ALPHA[x % 32]).join('') };
    save();
  }
  return data.wallet.code;
}
/** Code schön lesbar: ABCD-EFGH-… */
export const fmtCode = (c) => String(c || '').replace(/(.{4})(?=.)/g, '$1-');
export const parseCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[01IO]/g, '');

async function post(path, body) {
  const r = await fetch(API() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ...d, status: r.status, ok: r.ok };
}

let statusCache = null;
export async function shopStatus(force = false) {
  if (!API()) return { scan: false, sales: false };
  if (!force && statusCache && Date.now() - statusCache.t < 60000) return statusCache.v;
  try {
    const v = await (await fetch(API() + '/shop/status')).json();
    statusCache = { t: Date.now(), v };
    return v;
  } catch { return statusCache?.v || { scan: false, sales: false, offline: true }; }
}
export const walletStatus = () => post('/wallet', { code: walletCode() });
export const giveConsent = () => post('/wallet/consent', { code: walletCode(), age18: true, consent: true });
export const revokeConsent = () => post('/wallet/consent', { code: walletCode(), revoke: true });

/** Kauf-Code eines anderen Geräts übernehmen (prüft, ob es ihn gibt). */
export async function useCode(input) {
  const code = parseCode(input);
  if (!CODE_RE.test(code)) throw new Error('Der Code hat 20 Zeichen (Buchstaben und Zahlen).');
  const st = await post('/wallet', { code });
  if (!st.ok) throw new Error(st.error || 'Server nicht erreichbar');
  if (!st.purchases?.length && !st.consent) throw new Error('Zu diesem Code gibt es kein Guthaben.');
  data.wallet = { code };
  save();
  return st;
}

/** Foto → JPEG max. 1000 px (spart Kosten, entfernt Metadaten wie Ort). */
export async function prepImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild nicht lesbar')); i.src = url; });
    const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.8);
    return { type: 'image/jpeg', data: dataUrl.split(',')[1] };
  } finally { URL.revokeObjectURL(url); }
}

/** Scan ausführen. Rückgabe { items, note, left } oder Fehler mit .needConsent / .needBuy. */
export async function scan({ image = null, text = '' }) {
  const r = await post('/scan', { code: walletCode(), ...(image ? { image } : {}), ...(text ? { text } : {}) });
  if (!r.ok) throw Object.assign(new Error(r.error || 'Scan fehlgeschlagen'), { needConsent: !!r.needConsent || r.status === 403, needBuy: !!r.needBuy || r.status === 402, left: r.left });
  return r;
}

/**
 * Für jede erkannte Zutat: passenden Eintrag der App-Datenbank suchen (verlässlichere
 * Nährwerte), sonst die KI-Werte. Der Nutzer sieht, woher die Werte kommen.
 */
export function withNutrition(items) {
  return items.map((it) => {
    const first = it.name.toLowerCase().split(/[\s,(]+/).find((w) => w.length >= 3) || '';
    const hit = first ? searchLocal(it.name, { limit: 3 }).find((f) => !f.meal && f.name.toLowerCase().includes(first)) : null;
    const ai = { name: it.name, kcal: it.kcal100, p: it.p100, c: it.c100, f: it.f100, portion: 100, unit: '100 g', id: 'ki:' + it.name };
    return { ...it, ai, db: hit || null, use: hit ? 'db' : 'ai' };
  });
}

/** Kauf starten: Bestellung bestätigt → weiter zur Zahlungsseite von Stripe. */
export async function startCheckout(accept) {
  const r = await post('/shop/buy', { code: walletCode(), ...accept });
  if (!r.ok || !r.url) throw new Error(r.error || 'Kauf konnte nicht gestartet werden');
  location.href = r.url;
}

export const sendWiderruf = (form) => post('/widerruf', form);
export const sendReport = (rep) => post('/report', rep);
