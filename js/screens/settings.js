// =============================================================
// settings.js – Export / Import (JSON), eigene Übungen, Daten löschen
// =============================================================

import { go, render, ask, toast } from '../app.js';
import { data, importJSON, removeCustomExercise, wipeAll, setWeightUnit } from '../store.js';
import { listSnapshots, getSnapshot, exportFile, daysSinceExport, autoBackup } from '../backup.js';
import { status as pushStatus, enable as pushEnable, disable as pushDisable, scheduleRestPush, lastDelivery, diagnose } from '../push.js';
import { esc, dateStr, APP_VERSION, fmtDateLong } from '../util.js';
import { PUSH_SERVER } from '../push-config.js';
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

        <section class="card">
          <h3 class="section-title first">Gewichtseinheit</h3>
          <div class="seg-wrap seg-full" role="group" aria-label="Gewichtseinheit">
            <button class="seg-item${data.settings.unit === 'lb' ? '' : ' on'}" data-action="unit" data-u="kg">Kilogramm (kg)</button>
            <button class="seg-item${data.settings.unit === 'lb' ? ' on' : ''}" data-action="unit" data-u="lb">Pfund (lb)</button>
          </div>
          <p class="note">Gilt für Hanteln, Rekorde, Scheibenrechner und Körpergewicht. Alte Einträge werden umgerechnet angezeigt – nichts geht verloren.</p>
        </section>

        ${pushCard()}

        <section class="card">
          <h3 class="section-title first">Verbesserungsvorschlag</h3>
          <p class="muted small">Was fehlt dir, was nervt, was soll besser werden? Jeder Vorschlag wird gelesen.</p>
          <textarea id="fbText" class="input fb-text" rows="4" maxlength="2000" placeholder="z. B. „Ich hätte gern …“"></textarea>
          <input id="fbName" class="input fb-name" maxlength="40" placeholder="Dein Name (optional)" value="${esc(data.profile.name || '')}" autocomplete="off">
          <input id="fbWebsite" class="fb-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button class="btn primary big full" data-action="sendFeedback">Vorschlag senden</button>
        </section>

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

    unit: (el) => { setWeightUnit(el.dataset.u); toast(el.dataset.u === 'lb' ? 'Gewichte jetzt in Pfund (lb)' : 'Gewichte jetzt in Kilogramm (kg)'); render(); },

    sendFeedback: async (el) => {
      const text = document.getElementById('fbText').value.trim();
      if (text.length < 3) return toast('Bitte kurz beschreiben, was du dir wünschst');
      el.disabled = true;
      try {
        const r = await fetch(`${PUSH_SERVER}/feedback`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, name: document.getElementById('fbName').value.trim(), version: APP_VERSION, website: document.getElementById('fbWebsite').value }),
        });
        if (!r.ok) throw new Error();
        document.getElementById('fbText').value = '';
        toast('Danke! Dein Vorschlag ist angekommen.');
      } catch {
        toast('Senden hat nicht geklappt – Internet prüfen und nochmal versuchen');
      }
      el.disabled = false;
    },

    pushOn: async () => {
      try { await pushEnable(); toast('Mitteilungen an'); render(); } catch (e) { toast(e.message); }
    },
    pushOff: async () => { await pushDisable(); toast('Mitteilungen aus'); render(); },
    pushTest: async () => {
      const ok = await scheduleRestPush(Date.now() + 10000, 'Test: Noch 10 Sekunden Pause', 'So sieht die Mitteilung vor dem Pausenende aus.');
      if (!ok) return toast('Server nicht erreichbar');
      pushTestAt = Date.now();
      toast('Jetzt zum Home-Bildschirm wechseln – in 10 s kommt die Mitteilung');
    },
    pushCheck: () => checkDelivery(true),

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
    : st === 'on' ? '<button class="btn big" data-action="pushTest">Test in 10 Sekunden</button><button class="btn ghost full" data-action="pushCheck">Letzte Zustellung prüfen</button><button class="btn ghost full" data-action="pushOff">Ausschalten</button>'
    : '';
  return `<section class="card">
    <h3 class="section-title first">Mitteilung am Pausenende</h3>
    <p class="muted small">${text}</p>${btns ? `<div class="stack">${btns}</div>` : ''}
    <p class="source" id="pushDiag">${esc(diagnose())}</p>
  </section>`;
}

// Nach dem Test: beim Zurückkommen anzeigen, was Apple geantwortet hat
let pushTestAt = 0;
async function checkDelivery(manual) {
  try {
    const r = await lastDelivery();
    let msg;
    if (!r || r.none) msg = 'Noch keine Zustellung beim Server.';
    else if (r.status >= 200 && r.status < 300) msg = `Apple hat die Mitteilung angenommen (${r.status}). Kommt sie nicht an: iPhone-Einstellungen → Mitteilungen → Gym → Mitteilungen erlauben, Fokus/Nicht stören aus.`;
    else msg = `Fehler bei Apple: ${r.status} ${r.text || ''}`;
    const el = document.getElementById('pushDiag');
    if (el) el.textContent = `${diagnose()} · Letzte Zustellung: ${msg}`;
    if (manual || pushTestAt) toast(msg.slice(0, 120));
  } catch (e) {
    toast('Server nicht erreichbar: ' + e.message);
  }
  pushTestAt = 0;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pushTestAt && Date.now() - pushTestAt > 12000) setTimeout(() => checkDelivery(false), 800);
});
