// =============================================================
// account.js – Konto: anmelden + Daten auf allen Geräten aktuell halten
//
// Sicherheit (Ende-zu-Ende verschlüsselt):
//   Aus Name + Passwort entsteht im Gerät per PBKDF2 (310.000 Runden) ein
//   512-Bit-Wert. Die erste Hälfte geht als Prüfwert an den Server (der
//   speichert davon nur einen gesalzenen Hash), die zweite Hälfte ist der
//   AES-GCM-Schlüssel für die Daten. Der Server sieht weder Passwort noch Daten.
//   Folge: Passwort vergessen = Daten auf dem Server nicht mehr lesbar
//   (auf den eigenen Geräten bleiben sie, dort kann man ein neues Passwort setzen).
//
// Abgleich (mehrere Geräte, auch offline):
//   Jedes Gerät merkt sich den zuletzt abgeglichenen Stand („Basis“, in IndexedDB).
//   Beim Abgleich: eigener Stand, Server-Stand und Basis werden pro Eintrag
//   zusammengeführt (3-Wege). So bleiben Änderungen von beiden Geräten erhalten,
//   und Löschungen kommen überall an. Der Server zählt Versionen (rev) –
//   schreibt nur, wer den neuesten Stand kennt.
// =============================================================

import { data, replaceData, onSave } from './store.js';
import { PUSH_SERVER } from './push-config.js';

const API = () => (PUSH_SERVER || '').replace(/\/$/, '');
const SESSION_KEY = 'gym.acct';
const ITER = 310000;

// ---------- Kleine Helfer ----------

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
const b64 = (buf) => { let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const normName = (u) => String(u || '').trim().toLowerCase();
export const validName = (u) => /^[a-z0-9._-]{3,24}$/.test(normName(u));

/** JSON mit sortierten Schlüsseln (für verlässliches Vergleichen). */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
const same = (a, b) => stable(a) === stable(b);

// ---------- Sitzung (nur auf diesem Gerät) ----------

export function session() {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return s?.u && s.token && s.ek ? s : null; } catch { return null; }
}
const setSession = (s) => { try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* egal */ } };

// Basis-Stand in IndexedDB (kann groß werden, localStorage ist knapp)
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('gym-sync', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kv(op, key, val) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', op === 'get' ? 'readonly' : 'readwrite');
    const s = tx.objectStore('kv');
    const r = op === 'get' ? s.get(key) : op === 'del' ? s.delete(key) : s.put(val, key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const loadBase = () => kv('get', 'base').catch(() => null);
const saveBase = (b) => kv('put', 'base', b).catch(() => {});
const clearBase = () => kv('del', 'base').catch(() => {});

// ---------- Schlüssel ----------

/** Name + Passwort → { auth (hex, an Server), ek (Datenschlüssel, base64) }. */
export async function deriveKeys(u, password) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('gymapp-v1:' + normName(u)), iterations: ITER }, base, 512));
  return { auth: hex(bits.slice(0, 32)), ek: b64(bits.slice(32)) };
}
const aesKey = (ek) => crypto.subtle.importKey('raw', unb64(ek), 'AES-GCM', false, ['encrypt', 'decrypt']);

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Daten → verschlüsselter Text (vorher gzip, wenn das Gerät es kann). */
export async function encryptDoc(doc, ek) {
  let bytes = enc.encode(JSON.stringify(doc));
  let z = 0;
  if (typeof CompressionStream === 'function') { bytes = await pipe(bytes, new CompressionStream('gzip')); z = 1; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(ek), bytes);
  return JSON.stringify({ v: 1, z, iv: b64(iv), ct: b64(ct) });
}
export async function decryptDoc(text, ek) {
  const e = JSON.parse(text);
  let bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, await aesKey(ek), unb64(e.ct)));
  if (e.z) bytes = await pipe(bytes, new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ---------- Server ----------

async function call(op, body) {
  if (!API()) throw new Error('Kein Server eingerichtet');
  const r = await fetch(`${API()}/acct/${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { await signOutLocal(); throw Object.assign(new Error('Abgemeldet – bitte neu anmelden'), { code: 401 }); }
  if (!r.ok && r.status !== 409) throw Object.assign(new Error(d.error || `Fehler ${r.status}`), { code: r.status });
  return { ...d, status: r.status };
}

// ---------- Synchron-Ansicht der Daten ----------
// Freunde: nur Mitgliedschaft (id, code, name) – Kennzahlen holt jedes Gerät selbst vom Server.

const COLL = { sessions: 'id', food: 'id', water: 'id', drinks: 'id', meals: 'id', myFoods: 'id', myDrinks: 'code', supps: 'id', prs: 'id', customExercises: 'id', friends: 'id', body: 'date', planVersions: 'from' };
const OBJ = ['profile', 'settings', 'nutrition', 'drinkNutr', 'wallet'];

export function toSync(d) {
  const o = {};
  for (const k of Object.keys(COLL)) o[k] = (d[k] || []).map((x) => (k === 'friends' ? { id: x.id, name: x.name, ...(x.code ? { code: x.code } : {}) } : x));
  for (const k of OBJ) o[k] = d[k] || {};
  o.suppDone = d.suppDone || {};
  return JSON.parse(JSON.stringify(o));
}

/** Synchron-Stand zurück in App-Daten (lokale Freundes-Kennzahlen bleiben). */
function fromSync(s, local) {
  const out = { ...local, ...s, schema: local.schema };
  const lf = new Map((local.friends || []).map((f) => [f.id, f]));
  out.friends = (s.friends || []).map((f) => ({ ...(lf.get(f.id) || { t: 0, stats: {} }), ...f }));
  return out;
}

// ---------- 3-Wege-Zusammenführung ----------
// base = letzter gemeinsamer Stand (oder null beim ersten Abgleich), prefer = wer gewinnt,
// wenn beide denselben Eintrag verschieden geändert haben.

function mergeList(base, local, remote, key, prefer) {
  const id = (x) => String(x?.[key]);
  const B = new Map((base || []).map((x) => [id(x), x]));
  const L = new Map((local || []).map((x) => [id(x), x]));
  const R = new Map((remote || []).map((x) => [id(x), x]));
  const pick = (k) => {
    const b = B.get(k), l = L.get(k), r = R.get(k);
    if (l && r) return same(l, r) || (b && same(r, b)) ? l : b && same(l, b) ? r : prefer === 'remote' ? r : l;
    if (l) return b && same(l, b) ? null : l; // anderswo gelöscht (und hier unverändert) → weg
    if (r) return b && same(r, b) ? null : r; // hier gelöscht → weg; sonst neu von dort
    return null;
  };
  const order = [...L.keys(), ...[...R.keys()].filter((k) => !L.has(k))];
  return order.map(pick).filter(Boolean);
}

function mergeObj(base, local, remote, prefer) {
  const out = {};
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {}), ...Object.keys(base || {})]);
  for (const k of keys) {
    const b = base?.[k], l = local?.[k], r = remote?.[k];
    let v;
    if (same(l, r)) v = l;
    else if (base && same(l, b)) v = r;
    else if (base && same(r, b)) v = l;
    else v = prefer === 'remote' ? (r !== undefined ? r : l) : (l !== undefined ? l : r);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Abgehakte Supplements: je Tag als Menge zusammenführen. */
function mergeSets(base, local, remote) {
  const out = {};
  for (const day of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    const b = new Set(base?.[day] || []), l = new Set(local?.[day] || []), r = new Set(remote?.[day] || []);
    const all = new Set([...l, ...r]);
    const keep = [...all].filter((x) => !(b.has(x) && (!l.has(x) || !r.has(x)))); // auf einer Seite abgewählt → weg
    if (keep.length) out[day] = keep;
  }
  return out;
}

export function merge3(base, local, remote, prefer = 'local') {
  const o = {};
  for (const [k, key] of Object.entries(COLL)) o[k] = mergeList(base?.[k], local[k], remote[k], key, prefer);
  for (const k of OBJ) o[k] = mergeObj(base?.[k], local[k], remote[k], prefer);
  o.suppDone = mergeSets(base?.suppDone, local.suppDone, remote.suppDone);
  return o;
}

// ---------- Abgleich ----------

let busy = null;
let pushTimer = null;
const listeners = new Set();
export const onSynced = (fn) => listeners.add(fn);
const status = { last: 0, error: null };
export const syncStatus = () => ({ ...status, busy: !!busy });

/** Ein Abgleich: Server-Stand holen, zusammenführen, eigenen Stand hochladen. */
export function syncNow() {
  if (!session()) return Promise.resolve(false);
  if (busy) return busy;
  busy = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const s = session();
        if (!s) return false;
        const base = await loadBase();
        const local = toSync(data);
        const head = await call('rev', { u: s.u, token: s.token });
        let remote = null, rev = head.rev;
        if (!base || head.rev !== base.rev) {
          const p = await call('pull', { u: s.u, token: s.token });
          rev = p.rev;
          remote = p.doc ? await decryptDoc(p.doc, s.ek) : null;
        } else remote = base.doc;
        const merged = remote ? merge3(base && base.rev ? base.doc : null, local, remote, base ? 'local' : 'remote') : local;
        const changed = !same(merged, local);
        if (changed) apply(merged);
        if (!remote || !same(merged, remote)) {
          const r = await call('push', { u: s.u, token: s.token, base: rev, doc: await encryptDoc(merged, s.ek) });
          if (r.status === 409) continue; // jemand war schneller → nochmal mit neuem Stand
          rev = r.rev;
        }
        await saveBase({ rev, doc: merged });
        status.last = Date.now(); status.error = null;
        if (changed) listeners.forEach((fn) => fn());
        return true;
      }
      return false;
    } catch (e) {
      status.error = e.message;
      return false;
    } finally {
      busy = null;
    }
  })();
  return busy;
}

/** Zusammengeführten Stand übernehmen (ohne erneuten Upload auszulösen). */
function apply(merged) {
  const suppsBefore = stable(data.supps);
  replaceData(fromSync(merged, data));
  if (stable(data.supps) !== suppsBefore) import('./supps.js').then((m) => m.remindersOn() && m.syncSupps()).catch(() => {});
}

/** Nach lokalen Änderungen: kurz warten (mehrere Änderungen bündeln), dann abgleichen. */
function schedulePush() {
  if (!session()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncNow(), 2500);
}
onSave(schedulePush);

// ---------- Anmelden / Registrieren / Abmelden ----------

async function start(u, keys, token) {
  setSession({ u: normName(u), token, ek: keys.ek, since: Date.now() });
  await clearBase(); // erster Abgleich: eigene Daten + Konto-Daten zusammenführen
  await syncNow();
}

export async function register(u, password) {
  if (!validName(u)) throw new Error('Name: 3–24 Zeichen, nur a–z, 0–9, Punkt, Strich');
  if (String(password).length < 8) throw new Error('Passwort: mindestens 8 Zeichen');
  const keys = await deriveKeys(u, password);
  const r = await call('register', { u: normName(u), auth: keys.auth });
  if (r.status === 409) throw new Error('Name ist schon vergeben');
  await start(u, keys, r.token);
}

export async function login(u, password) {
  if (!validName(u)) throw new Error('Name oder Passwort falsch');
  const keys = await deriveKeys(u, password);
  const r = await call('login', { u: normName(u), auth: keys.auth });
  await start(u, keys, r.token);
}

async function signOutLocal() {
  setSession(null);
  await clearBase();
}

export async function logout() {
  const s = session();
  if (s) await call('logout', { u: s.u, token: s.token }).catch(() => {});
  await signOutLocal();
}

/** Passwort ändern (auf einem angemeldeten Gerät). Andere Geräte müssen sich danach neu anmelden. */
export async function changePassword(oldPw, newPw) {
  const s = session();
  if (!s) throw new Error('Nicht angemeldet');
  if (String(newPw).length < 8) throw new Error('Neues Passwort: mindestens 8 Zeichen');
  await syncNow();
  const [o, n] = await Promise.all([deriveKeys(s.u, oldPw), deriveKeys(s.u, newPw)]);
  const doc = toSync(data);
  const r = await call('passwd', { u: s.u, token: s.token, auth: o.auth, newAuth: n.auth, doc: await encryptDoc(doc, n.ek) });
  setSession({ ...s, ek: n.ek });
  await saveBase({ rev: r.rev, doc });
}

/** Konto samt Daten auf dem Server löschen (Daten auf diesem Gerät bleiben). */
export async function deleteAccount() {
  const s = session();
  if (!s) return;
  await call('delete', { u: s.u, token: s.token });
  await signOutLocal();
}
