// =============================================================
// backup.js – automatische Sicherungen
//
// 1. Tägliche Schnappschüsse (automatisch, ohne Zutun):
//    beim App-Start und nach jedem gespeicherten Workout wird der
//    aktuelle Stand in IndexedDB abgelegt – ein Schnappschuss pro Tag,
//    die letzten 14 Tage bleiben erhalten. Schützt vor Fehlbedienung
//    (z. B. versehentlich gelöscht, falscher Import).
// 2. Datei-Sicherung außerhalb des iPhones (iCloud Drive / Dateien):
//    iOS erlaubt Web-Apps nicht, unbemerkt Dateien zu speichern. Darum
//    erinnert die App alle 7 Tage und sichert mit einem Tipp.
//
// Sicherheitsregel: Ein Schnappschuss überschreibt nie einen Stand mit
// mehr Workouts (sonst würde ein versehentliches Löschen die Sicherung
// des Tages gleich mit zerstören).
// =============================================================

import { data, exportJSON } from './store.js';
import { dateStr } from './util.js';

const DB = 'gym-backup';
const STORE = 'snaps';
const KEEP = 14;
const EXPORT_KEY = 'gym.lastExport';
export const REMIND_DAYS = 7;

function open() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in self)) return rej(new Error('kein IndexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}

/** Alle Schnappschüsse, neueste zuerst (ohne JSON-Inhalt). */
export async function listSnapshots() {
  try {
    const db = await open();
    const all = await tx(db, 'readonly', (s) => s.getAll());
    return all.sort((a, b) => b.at - a.at).map(({ json, ...meta }) => meta);
  } catch {
    return [];
  }
}

export async function getSnapshot(id) {
  const db = await open();
  return tx(db, 'readonly', (s) => s.get(id));
}

/** Schnappschuss des aktuellen Stands (einmal pro Tag, wird im Laufe des Tages aktualisiert). */
export async function autoBackup(tag = '') {
  if (!data.sessions.length && !data.planVersions.length) return false;
  try {
    const db = await open();
    const id = dateStr() + tag;
    const old = await tx(db, 'readonly', (s) => s.get(id));
    if (old && old.sessions > data.sessions.length) return false;
    await tx(db, 'readwrite', (s) => s.put({ id, at: Date.now(), sessions: data.sessions.length, json: exportJSON() }));
    const all = (await tx(db, 'readonly', (s) => s.getAllKeys())).sort();
    const drop = all.slice(0, Math.max(0, all.length - KEEP));
    if (drop.length) await tx(db, 'readwrite', (s) => drop.forEach((k) => s.delete(k)));
    return true;
  } catch (e) {
    console.warn('Automatische Sicherung fehlgeschlagen', e);
    return false;
  }
}

/** Browser bitten, die Daten nicht bei Speicherknappheit zu löschen. */
export function requestPersist() {
  try { navigator.storage?.persist?.(); } catch { /* egal */ }
}

// ---------- Datei-Sicherung ----------

export function lastExport() {
  try { return Number(localStorage.getItem(EXPORT_KEY)) || 0; } catch { return 0; }
}
export function markExported() {
  try { localStorage.setItem(EXPORT_KEY, String(Date.now())); } catch { /* egal */ }
}

/** Tage seit der letzten Datei-Sicherung (Infinity = noch nie). */
export function daysSinceExport() {
  const t = lastExport();
  return t ? Math.floor((Date.now() - t) / 864e5) : Infinity;
}

/** Soll an die Datei-Sicherung erinnert werden? */
export function exportDue() {
  return data.sessions.length >= 3 && daysSinceExport() >= REMIND_DAYS;
}

/** Backup-Datei über das Teilen-Menü (iPhone: „In Dateien sichern“) oder als Download. */
export async function exportFile() {
  const json = exportJSON();
  const name = `training-backup-${dateStr()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      markExported();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  markExported();
  return true;
}
