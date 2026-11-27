// =============================================================
// settings.js – Export / Import (JSON), eigene Übungen, Daten löschen
// =============================================================

import { go, render, ask, toast, openSheet } from '../app.js';
import { data, importJSON, removeCustomExercise, wipeAll, resetTraining, setWeightUnit } from '../store.js';
import { listSnapshots, getSnapshot, exportFile, daysSinceExport, autoBackup } from '../backup.js';
import { status as pushStatus, enable as pushEnable, disable as pushDisable, scheduleRestPush, lastDelivery, diagnose } from '../push.js';
import { esc, dateStr, APP_VERSION, fmtDateLong } from '../util.js';
import { PUSH_SERVER } from '../push-config.js';
import { muscleNames } from '../exercises.js';
import { discardActive } from './workout.js';
import { ICON } from './icons.js';
import { tabBar } from './tabbar.js';
import { visibleNews, unseen, markSeen, hideNews } from '../news.js';

/** Neuheiten: eine Zeile pro Funktion, neueste oben, auf-/zuklappbar (Zustand pro Gerät). */
const NEWS_OPEN = 'gym.newsOpen';
function newsOpen(hasFresh) {
  try { const v = localStorage.getItem(NEWS_OPEN); return v == null ? true : v === '1' || hasFresh; } catch { return true; }
}
function newsCard() {
  const fresh = new Set(unseen().map((n) => n.id));
  const list = visibleNews();
  const open = newsOpen(fresh.size > 0);
  const rows = list.map((n) => `<li class="news-row${fresh.has(n.id) ? ' fresh' : ''}" data-id="${esc(n.id)}">
      <span class="news-title">${fresh.has(n.id) ? '<i class="news-new">Neu</i>' : ''}${esc(n.title)}</span>
      <span class="news-text">${esc(n.text)}</span>
      <span class="news-foot"><span class="news-where">${ICON.chev}${esc(n.where)}</span>
        <span class="news-acts"><button class="news-act del" data-action="newsDel" data-id="${esc(n.id)}" aria-label="${esc(n.title)} löschen">${ICON.trash} Löschen</button></span></span></li>`).join('');
  return `<section class="card news-card${open ? ' open' : ''}" id="news">
    <button class="news-toggle" data-action="newsToggle" aria-expanded="${open}" aria-controls="newsList">
      <h2>Neuheiten</h2>${fresh.size ? `<span class="news-count">${fresh.size} neu</span>` : `<span class="muted small">${list.length || ''}</span>`}<span class="news-chev">${ICON.chevDown}</span></button>
    <div class="news-body" id="newsList"><div class="news-inner">
      ${rows ? `<ul class="news-list">${rows}</ul>` : '<p class="muted small news-empty">Keine Neuheiten – neue Funktionen erscheinen hier.</p>'}
    </div></div>
  </section>`;
}

export const settingsScreen = {
  render() {
    const first = data.planVersions[0]?.from;

    return `
      <main class="content no-title has-tabbar">
        ${newsCard()}

        <section class="card list-card set-list">
          <div class="set-row unit-row"><span class="set-ic">${ICON.scale}</span><span class="lr-main"><span class="lr-title">Gewichtseinheit</span></span>
            <div class="seg-wrap" role="group" aria-label="Gewichtseinheit">
              <button class="seg-item${data.settings.unit === 'lb' ? '' : ' on'}" data-action="unit" data-u="kg">kg</button>
              <button class="seg-item${data.settings.unit === 'lb' ? ' on' : ''}" data-action="unit" data-u="lb">lb</button>
            </div></div>
          ${setRow('openPush', ICON.bell, 'Mitteilungen', pushLabel())}
          ${setRow('openBackup', ICON.shield, 'Datensicherung', exportShort())}
          ${setRow('openCustom', ICON.dumbbell, 'Eigene Übungen', data.customExercises.length ? `${data.customExercises.length} angelegt` : 'Noch keine')}
        </section>

        <section class="card list-card set-list">
          ${setRow('openFeedback', ICON.edit, 'Verbesserungsvorschlag', 'Was fehlt dir? Jeder Vorschlag wird gelesen.')}
        </section>

        <section class="card">
          <h3 class="section-title first">Info</h3>
          <p class="muted small">
            ${data.sessions.length} gespeicherte Workouts${first ? ` · Plan seit ${fmtDateLong(first)}` : ''}<br>
            Version ${APP_VERSION}
          </p>
          <button class="btn ghost full" data-action="resetTraining">Fortschritt zurücksetzen</button>
          <button class="btn ghost danger full" data-action="wipe">Alle Daten löschen</button>
        </section>
      </main>
      ${tabBar('settings')}`;
  },

  after(root) {
    // Angeschaut = gesehen: roter Punkt weg (die „Neu“-Markierung bleibt bis zum nächsten Öffnen sichtbar)
    markSeen();
    document.querySelector('.tab-dot')?.remove();
    // Neuheiten gelten als gelesen, sobald man sie gesehen hat (Markierung „Neu“ bleibt bis zum nächsten Öffnen)
  },

  actions: {
    back: () => go('home'),

    export: async () => { if (await exportFile()) render(); },

    newsDel: (el) => { hideNews(el.dataset.id); render(); },
    newsToggle: (el) => {
      const card = el.closest('.news-card');
      const open = !card.classList.contains('open');
      card.classList.toggle('open', open);
      el.setAttribute('aria-expanded', open);
      try { localStorage.setItem(NEWS_OPEN, open ? '1' : '0'); } catch { /* egal */ }
    },
    openPush: () => openPushSheet(),
    openBackup: () => openBackupSheet(),
    openCustom: () => openCustomSheet(),
    openFeedback: () => openFeedbackSheet(),

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
      try { await pushEnable(); toast('Mitteilungen an'); import('../friends.js').then((f) => f.registerPushSub()); render(); } catch (e) { toast(e.message); }
    },
    pushOff: async () => { await pushDisable(); import('../friends.js').then((f) => f.registerPushSub(true)); toast('Mitteilungen aus'); render(); },
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

    resetTraining: async () => {
      if (!data.sessions.length) return toast('Noch keine Workouts – du startest schon bei null');
      if (!(await confirm3([
        ['Fortschritt zurücksetzen?', `Alle ${data.sessions.length} Workouts, Rekorde, Streak und Kraftverlauf werden gelöscht – du startest bei null. Plan, Freunde, Ernährung, Supplements und Körpergewicht bleiben.`, 'Weiter'],
        ['Wirklich sicher?', 'Dein ganzer Trainingsverlauf ist danach weg. Vorher wird eine Sicherung gemacht (14 Tage unter „Datensicherung“).', 'Ja, sicher'],
        ['Letzte Bestätigung', `Jetzt ${data.sessions.length} Workouts endgültig zurücksetzen?`, 'Zurücksetzen'],
      ]))) return;
      await autoBackup('-vor-neustart');
      resetTraining();
      discardActive();
      import('../friends.js').then((f) => f.publishMe(true)).catch(() => {}); // Rangliste: auch für Freunde bei null
      toast('Fortschritt zurückgesetzt – viel Erfolg!');
      go('home');
    },

    wipe: async () => {
      if (!(await confirm3([
        ['Alle Daten löschen?', 'Plan, Workouts, Ernährung, Supplements, Freunde-Liste und eigene Übungen werden gelöscht.', 'Weiter'],
        ['Wirklich sicher?', 'Die App ist danach wie neu installiert. Ein letzter Schnappschuss bleibt 14 Tage unter „Datensicherung“.', 'Ja, sicher'],
        ['Letzte Bestätigung', 'Jetzt alle Daten endgültig löschen?', 'Alles löschen'],
      ]))) return;
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
    const tag = sn.id.includes('-vor-loeschen') ? ' · vor dem Löschen' : sn.id.includes('-vor-neustart') ? ' · vor dem Neustart' : sn.id.includes('-vorher') ? ' · vor Wiederherstellung' : '';
    return `<li><span>${esc(label)}<br><span class="muted small">${sn.sessions} Workouts${tag}</span></span>
      <button class="chip" data-action="restore" data-id="${esc(sn.id)}">Wiederherstellen</button></li>`;
  }).join('') : '<li class="muted small">Noch keine – die erste entsteht, sobald du einen Plan oder ein Workout hast.</li>';
}

/** Gefährliche Aktionen: dreimal nacheinander bestätigen. steps = [[Titel, Text, Knopf], …] */
async function confirm3(steps) {
  for (const [title, text, okLabel] of steps) {
    if (!(await ask(title, text, okLabel, true))) { toast('Abgebrochen – nichts gelöscht'); return false; }
    await new Promise((r) => setTimeout(r, 250)); // kein versehentlicher Doppeltipp durch alle Stufen
  }
  return true;
}

// ---------- Zeilen + Unterfenster ----------

const setRow = (action, icon, title, sub) => `<button class="list-row set-row" data-action="${action}">
  <span class="set-ic">${icon}</span><span class="lr-main"><span class="lr-title">${title}</span><span class="lr-sub">${sub}</span></span>
  <span class="chev">${ICON.chev}</span></button>`;

function pushLabel() {
  return { on: 'An – Pausenende und Supplements', off: '<b class="warn-text">Aus</b> – antippen zum Einschalten', denied: '<b class="warn-text">Blockiert</b>', 'not-installed': 'Nur in der App vom Home-Bildschirm', unsupported: 'Nicht unterstützt', 'not-configured': 'Nicht eingerichtet' }[pushStatus()];
}
function exportShort() {
  const d = daysSinceExport();
  return `Automatisch täglich · ${d === Infinity ? '<b class="warn-text">Datei noch nie gesichert</b>' : d === 0 ? 'Datei heute gesichert' : `Datei vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}`}`;
}

/** Aktionen der Einstellungen auch in den Unterfenstern verfügbar; reopen = Fenster danach neu zeichnen. */
const sheetActs = (reopen) => {
  const A = settingsScreen.actions;
  const wrap = (fn) => async (el, ev) => { await fn(el, ev); if (document.getElementById('sheet')?.hidden === false || reopen) reopen?.(); };
  return { ...A, pushOn: wrap(A.pushOn), pushOff: wrap(A.pushOff), export: wrap(A.export), delCustom: wrap(A.delCustom) };
};

function openPushSheet() {
  openSheet(`<h2 class="sheet-title">Mitteilungen</h2>${pushCard()}`, sheetActs(openPushSheet));
}

function openBackupSheet() {
  openSheet(`<h2 class="sheet-title">Datensicherung</h2>
    <p class="muted small sheet-sub">Automatisch: jeden Tag ein Schnappschuss auf diesem Gerät, die letzten 14 Tage bleiben erhalten.</p>
    <ul class="plain-list snaps" id="snaps"><li class="muted small">Lade Sicherungen …</li></ul>
    <h3 class="sheet-h">In iCloud Drive / Dateien</h3>
    <p class="muted small">Schützt auch bei Verlust des Handys. ${exportInfo()}</p>
    <div class="stack">
      <button class="btn primary big" data-action="export">${ICON.share} Backup-Datei sichern</button>
      <label class="btn big file-btn">Backup importieren<input type="file" accept="application/json,.json" id="importFile" hidden></label>
    </div>`, sheetActs(openBackupSheet));
  const sheet = document.getElementById('sheet');
  sheet.querySelector('#importFile').addEventListener('change', onImport);
  fillSnapshots(sheet);
}

function openCustomSheet() {
  const custom = data.customExercises
    .map((e) => `<li><span><b>${esc(e.name)}</b><br><span class="muted small">${esc(muscleNames(e.primary))}</span></span>
      <button class="icon-btn sm" data-action="delCustom" data-id="${esc(e.id)}" aria-label="Löschen">${ICON.x}</button></li>`).join('');
  openSheet(`<h2 class="sheet-title">Eigene Übungen</h2>
    ${custom ? `<ul class="plain-list">${custom}</ul>` : '<p class="muted">Noch keine. Anlegen im Plan über „Übung hinzufügen“.</p>'}`, sheetActs(openCustomSheet));
}

function openFeedbackSheet() {
  openSheet(`<h2 class="sheet-title">Verbesserungsvorschlag</h2>
    <p class="muted small sheet-sub">Was fehlt dir, was nervt, was soll besser werden? Jeder Vorschlag wird gelesen.</p>
    <textarea id="fbText" class="input fb-text" rows="5" maxlength="2000" placeholder="z. B. „Ich hätte gern …“"></textarea>
    <input id="fbName" class="input fb-name" maxlength="40" placeholder="Dein Name (optional)" value="${esc(data.profile.name || '')}" autocomplete="off">
    <input id="fbWebsite" class="fb-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn primary big full" data-action="sendFeedback">Vorschlag senden</button>`, sheetActs(null));
  setTimeout(() => document.getElementById('fbText')?.focus(), 350);
}

/** Karte: Mitteilung am Pausenende (Push). */
function pushCard() {
  const st = pushStatus();
  const text = {
    'not-configured': 'Noch nicht eingerichtet: Der Push-Server fehlt (siehe README, Abschnitt „Pausen-Mitteilung“).',
    'not-installed': 'Funktioniert nur in der App vom Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm), ab iOS 16.4.',
    unsupported: 'Dieses Gerät unterstützt keine Web-Mitteilungen (iOS 16.4 oder neuer nötig).',
    denied: 'Mitteilungen sind blockiert. Erlauben unter iPhone-Einstellungen → Mitteilungen → Gym.',
    off: 'Für die Mitteilung 10 Sekunden vor Pausenende und deine Supplement-Erinnerungen – auch bei geschlossener App und gesperrtem Handy.',
    on: 'An. Pausenende: 10 Sekunden vorher kommt eine Mitteilung, wenn du die App verlassen hast (in der App piept sie). Supplements: zur eingestellten Uhrzeit.',
  }[st];
  const btns = st === 'off' ? '<button class="btn primary big" data-action="pushOn">Mitteilungen einschalten</button>'
    : st === 'on' ? '<button class="btn big" data-action="pushTest">Test in 10 Sekunden</button><button class="btn ghost full" data-action="pushCheck">Letzte Zustellung prüfen</button><button class="btn ghost full" data-action="pushOff">Ausschalten</button>'
    : '';
  return `<section class="push-box">
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
