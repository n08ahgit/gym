// =============================================================
// settings.js – Export / Import (JSON), eigene Übungen, Daten löschen
// =============================================================

import { go, render, ask, toast } from '../app.js';
import { data, importJSON, removeCustomExercise, wipeAll } from '../store.js';
import { listSnapshots, getSnapshot, exportFile, daysSinceExport, autoBackup } from '../backup.js';
import { status as pushStatus, enable as pushEnable, disable as pushDisable, scheduleRestPush } from '../push.js';
import { esc, dateStr, APP_VERSION, fmtDateLong } from '../util.js';
import { muscleNames } from '../exercises.js';
import { discardActive } from './workout.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';

export const settingsScreen = {
  render() {
    const first = data.planVersions[0]?.from;
    const custom = data.customExercises
      .map((e) => `<li><span><b>${esc(e.name)}</b><br><span class="muted small">${esc(muscleNames(e.primary))}</span></span>
        <button class="icon-btn sm" data-action="delCustom" data-id="${esc(e.id)}" aria-label="Löschen">${ICON.x}</button></li>`)
      .join('');

    return `
      <main class="content no-title has-tabbar">
        <section class="card">
          <h3 class="section-title first">Datensicherung</h3>
          <p class="muted small">Automatisch: jeden Tag ein Schnappschuss auf diesem iPhone, die letzten 14 Tage bleiben erhalten.</p>
          <ul class="plain-list snaps" id="snaps"><li class="muted small">Lade Sicherungen …</li></ul>
          <h4 class="sub-title">In iCloud Drive / Dateien</h4>
          <p class="muted small">Schützt auch bei Verlust des iPhones. ${exportInfo()}</p>
          <button class="btn primary big" data-action="export">${ICON.share} Backup-Datei sichern</button>
          <label class="btn big file-btn">Backup importieren
            <input type="file" accept="application/json,.json" id="importFile" hidden>
          </label>
        </section>

        ${pushCard()}

        <section class="card">
          <h3 class="section-title first">Eigene Übungen</h3>
          ${custom ? `<ul class="plain-list">${custom}</ul>` : '<p class="muted small">Noch keine. Anlegen über „Übung hinzufügen“ im Plan.</p>'}
        </section>

        <section class="card">
          <h3 class="section-title first">Info</h3>
          <p class="muted small">
            ${data.sessions.length} gespeicherte Workouts${first ? ` · Plan seit ${fmtDateLong(first)}` : ''}<br>
            Version ${APP_VERSION}
          </p>
          <button class="btn ghost danger full" data-action="wipe">Alle Daten löschen</button>
        </section>
      </main>
      ${tabBar('settings')}`;
  },

  after(root) {
    root.querySelector('#importFile').addEventListener('change', onImport);
    fillSnapshots(root);
  },

  actions: {
    back: () => go('home'),

    export: async () => { if (await exportFile()) render(); },

    pushOn: async () => {
      try { await pushEnable(); toast('Mitteilungen an'); render(); } catch (e) { toast(e.message); }
    },
    pushOff: async () => { await pushDisable(); toast('Mitteilungen aus'); render(); },
    pushTest: async () => {
      const ok = await scheduleRestPush(Date.now() + 10000, 'Test: Noch 10 Sekunden Pause', 'So sieht die Mitteilung vor dem Pausenende aus.');
      toast(ok ? 'Jetzt zum Home-Bildschirm wechseln – in 10 s kommt die Mitteilung' : 'Server nicht erreichbar');
    },

    restore: async (el) => {
      const snap = await getSnapshot(el.dataset.id);
      if (!snap) return toast('Sicherung nicht gefunden');
      if (!(await ask('Diese Sicherung wiederherstellen?', `Stand vom ${new Date(snap.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} mit ${snap.sessions} Workouts. Der aktuelle Stand wird vorher ebenfalls gesichert.`, 'Wiederherstellen', true))) return;
      await autoBackup('-vorher');
      importJSON(snap.json);
      toast('Sicherung wiederhergestellt');
      setTimeout(() => location.reload(), 600);
    },

    delCustom: async (el) => {
      const ex = data.customExercises.find((e) => e.id === el.dataset.id);
      if (!(await ask(`„${ex.name}“ löschen?`, 'Im Plan und in alten Workouts bleibt der Name erhalten.', 'Löschen', true))) return;
      removeCustomExercise(ex.id);
      render();
    },

    wipe: async () => {
      if (!(await ask('Alle Daten löschen?', 'Plan, Workouts und eigene Übungen werden gelöscht. Ein letzter Schnappschuss bleibt unter „Datensicherung“ erhalten.', 'Alles löschen', true))) return;
      await autoBackup('-vor-loeschen');
      wipeAll();
      discardActive();
      toast('Alle Daten gelöscht');
      go('home');
    },
  },
};

async function onImport(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    JSON.parse(text); // Syntax vorab prüfen
    if (!(await ask('Backup importieren?', 'Alle aktuellen Daten auf diesem Gerät werden durch das Backup ersetzt.', 'Importieren', true))) return;
    importJSON(text);
    // Laufendes Workout aus dem Backup übernehmen -> Seite neu laden ist am sichersten
    toast('Backup importiert');
    setTimeout(() => location.reload(), 600);
  } catch (err) {
    console.error(err);
    toast('Import fehlgeschlagen: ungültige Datei');
  }
}

function exportInfo() {
  const d = daysSinceExport();
  if (d === Infinity) return '<b class="warn-text">Noch nie gesichert.</b>';
  return d === 0 ? 'Zuletzt heute gesichert.' : `Zuletzt vor ${d} ${d === 1 ? 'Tag' : 'Tagen'} gesichert.`;
}

async function fillSnapshots(root) {
  const ul = root.querySelector('#snaps');
  const list = await listSnapshots();
  if (!ul.isConnected) return;
  ul.innerHTML = list.length ? list.map((sn) => {
    const label = new Date(sn.at).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const tag = sn.id.includes('-vor-loeschen') ? ' · vor dem Löschen' : sn.id.includes('-vorher') ? ' · vor Wiederherstellung' : '';
    return `<li><span>${esc(label)}<br><span class="muted small">${sn.sessions} Workouts${tag}</span></span>
      <button class="chip" data-action="restore" data-id="${esc(sn.id)}">Wiederherstellen</button></li>`;
  }).join('') : '<li class="muted small">Noch keine – die erste entsteht, sobald du einen Plan oder ein Workout hast.</li>';
}

/** Karte: Mitteilung am Pausenende (Push). */
function pushCard() {
  const st = pushStatus();
  const text = {
    'not-configured': 'Noch nicht eingerichtet: Der Push-Server fehlt (siehe README, Abschnitt „Pausen-Mitteilung“).',
    'not-installed': 'Funktioniert nur in der App vom Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm), ab iOS 16.4.',
    unsupported: 'Dieses Gerät unterstützt keine Web-Mitteilungen (iOS 16.4 oder neuer nötig).',
    denied: 'Mitteilungen sind blockiert. Erlauben unter iPhone-Einstellungen → Mitteilungen → Gym.',
    off: 'Verlässt du die App während einer Pause, bekommst du 10 Sekunden vor dem Ende eine Mitteilung – auch bei gesperrtem iPhone.',
    on: 'An. Verlässt du die App während einer Pause, kommt 10 Sekunden vor dem Ende eine Mitteilung. Bist du in der App, piept sie wie gewohnt.',
  }[st];
  const btns = st === 'off' ? '<button class="btn primary big" data-action="pushOn">Mitteilungen einschalten</button>'
    : st === 'on' ? '<button class="btn big" data-action="pushTest">Test in 10 Sekunden</button><button class="btn ghost full" data-action="pushOff">Ausschalten</button>'
    : '';
  return `<section class="card">
    <h3 class="section-title first">Mitteilung am Pausenende</h3>
    <p class="muted small">${text}</p>${btns ? `<div class="stack">${btns}</div>` : ''}
  </section>`;
}
