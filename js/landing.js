// =============================================================
// landing.js – Startseite für alle, die den Link im Browser öffnen
//
// Wer die App vom Home-Bildschirm startet, sieht direkt die App.
// Wer den Link im Browser öffnet (z. B. aus WhatsApp), sieht diese Seite:
// was die App kann, Bilder, und eine Anleitung passend zum Gerät.
// Freundes-Links (#f=…) zeigen zusätzlich die Einladung mit Code.
// =============================================================

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const inApp = /CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|Line\/|GSA\/|WhatsApp|Snapchat/.test(ua);
import { PUSH_SERVER, SHARE_BASE } from './push-config.js';

const shortInvite = location.pathname.match(/\/f\/([A-Za-z2-9]{6})\/?$/)?.[1]?.toUpperCase() || null;
// Bei Einladungs-Links (…/f/CODE) zeigt "Link kopieren" auf die Startseite, nicht auf die Einladung
const appUrl = shortInvite ? `${SHARE_BASE}/` : location.href.split('#')[0].split('?')[0];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (d, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  share: svg('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', 18),
  plus: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>', 18),
  dots: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>', 18),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 18),
  plan: svg('<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>'),
  up: svg('<path d="M4 18l6-6 4 4 6-8"/><path d="M15 8h5v5"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
};

const FEATURES = [
  [I.plan, 'Trainingsplan Mo–So', 'Übungen aus über 100 Vorlagen, Sätze und Pausen pro Übung. Workouts auf andere Tage kopieren.'],
  [I.timer, 'Workout-Modus', 'Satz für Satz mit „Letztes Mal“, Pausen-Timer und Mitteilung kurz vor Pausenende.'],
  [I.up, 'Steigerung nach Studienlage', 'Vorschlag fürs heutige Gewicht und die Wiederholungen – nach aktuellen Meta-Analysen zum Muskelaufbau.'],
  [I.info, 'Ausführung & Tipps', 'Zu jeder Übung die wichtigsten Punkte, Wiederholungsbereich, Pause und Tempo.'],
  [I.users, 'Rangliste mit Freunden', 'Konstanz, Streak, Volumen und Kraft im Vergleich – per Link, ohne Konto.'],
  [I.chart, 'Fortschritt & Rekorde', 'Kraftverlauf, Muskelbalance, Körpergewicht und Jahresübersicht.'],
];

const SHOTS = [['home', 'Plan & Streak'], ['workout', 'Workout'], ['progress', 'Fortschritt'], ['friends', 'Freunde']];

function inviteFrom(hash) {
  if (!hash.startsWith('#f=')) return null;
  try {
    let s = hash.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return o?.n ? { name: String(o.n).slice(0, 24), code: hash.slice(3) } : null;
  } catch {
    return null;
  }
}

function steps() {
  if (isIOS && inApp) {
    return `<p class="ld-warn">Du bist gerade in einem App-Browser (z. B. WhatsApp oder Instagram). Installieren geht nur in <b>Safari</b>.</p>
      <ol class="ld-steps">
        <li><span>Link kopieren</span><button class="btn ld-mini" data-copy="${esc(appUrl)}">${I.copy} Link kopieren</button></li>
        <li><span><b>Safari</b> öffnen, Link in die Adresszeile einfügen</span></li>
        <li><span>Dann den Schritten hier auf der Seite folgen</span></li>
      </ol>`;
  }
  if (isIOS) {
    return `<ol class="ld-steps">
        <li><span>Unten auf <b>Teilen</b> tippen <i class="ld-key">${I.share}</i><small>Bei iOS 26: zuerst auf <i class="ld-key">${I.dots}</i>, dann „Teilen“</small></span></li>
        <li><span><b>Zum Home-Bildschirm</b> wählen <i class="ld-key">${I.plus}</i><small>Evtl. nach unten scrollen oder „Mehr“ antippen</small></span></li>
        <li><span>Oben rechts <b>Hinzufügen</b></span></li>
        <li><span>Die App ab jetzt über das neue <b>Icon</b> öffnen</span></li>
      </ol>`;
  }
  if (isAndroid) {
    return `<ol class="ld-steps">
        <li><span>In <b>Chrome</b> oben rechts auf <i class="ld-key">${I.dots}</i> tippen</span></li>
        <li><span><b>App installieren</b> bzw. „Zum Startbildschirm hinzufügen“</span></li>
        <li><span>Die App über das neue <b>Icon</b> öffnen</span></li>
      </ol>
      <button class="btn primary big ld-install" hidden>App installieren</button>`;
  }
  return `<ol class="ld-steps">
      <li><span>Diesen Link auf dem <b>Handy</b> öffnen (iPhone: in Safari)</span><button class="btn ld-mini" data-copy="${esc(appUrl)}">${I.copy} Link kopieren</button></li>
      <li><span>Zum Home-Bildschirm hinzufügen – die Seite zeigt dort die Schritte für dein Gerät</span></li>
    </ol>`;
}

async function shortInviteInfo() {
  if (!shortInvite) return null;
  try {
    const r = await fetch(`${PUSH_SERVER}/friend/${shortInvite}`);
    const e = r.ok ? await r.json() : null;
    return { name: e?.name || null, code: shortInvite };
  } catch {
    return { name: null, code: shortInvite };
  }
}

async function render() {
  const inv = (await shortInviteInfo()) || inviteFrom(location.hash);
  document.title = 'Gym – Trainingsplan & Workout-Tracker';
  const root = document.getElementById('app');
  root.className = 'landing';
  root.innerHTML = `
    <header class="ld-hero">
      <img class="ld-icon" src="icons/icon-192.png" alt="" width="72" height="72">
      <h1>Dein Training.<br>Klar geplant, sauber getrackt.</h1>
      <p class="ld-lead">Trainingsplan, Workout-Tracker mit Pausen-Timer, Fortschritt und Rangliste mit Freunden. Kostenlos, ohne Konto, ohne Werbung.</p>
      <a class="btn primary big ld-cta" href="#installieren">${isIOS || isAndroid ? 'App installieren' : 'So bekommst du die App'}</a>
    </header>

    ${inv ? `<section class="ld-invite">
      <h2>${inv.name ? `${esc(inv.name)} lädt dich zur Gym-Rangliste ein` : 'Einladung zur Gym-Rangliste'}</h2>
      ${inv.code.length === 6
        ? `<div class="ld-code" aria-label="Einladungscode">${esc(inv.code)}</div>
           <p>1. App unten installieren · 2. App öffnen → <b>Freunde</b> · 3. Bei <b>Freund hinzufügen</b> diesen Code eingeben.</p>
           <button class="btn big" data-copy="${esc(inv.code)}">${I.copy} Code kopieren</button>`
        : `<p>Installiere die App, öffne sie und geh auf <b>Freunde → Freund hinzufügen</b>. Dort den Code einfügen:</p>
           <button class="btn big ld-copy-code" data-copy="${esc(inv.code)}">${I.copy} Einladungscode kopieren</button>`}
    </section>` : ''}

    <section class="ld-shots" aria-label="Bilder der App">
      ${SHOTS.map(([f, cap]) => `<figure class="ld-phone"><img src="img/landing/${f}.webp" alt="${cap}" width="300" height="511" loading="lazy" decoding="async"><figcaption>${cap}</figcaption></figure>`).join('')}
    </section>

    <section class="ld-section">
      <h2>Was die App kann</h2>
      <ul class="ld-features">
        ${FEATURES.map(([ic, t, d]) => `<li><span class="ld-ficon">${ic}</span><span><b>${t}</b><span>${d}</span></span></li>`).join('')}
      </ul>
    </section>

    <section class="ld-section ld-install-card" id="installieren">
      <h2>${isIOS ? 'Auf dem iPhone installieren' : isAndroid ? 'Auf Android installieren' : 'Installieren'}</h2>
      ${steps()}
      <p class="ld-note">Funktioniert wie eine normale App: Vollbild, offline, mit Mitteilungen. Updates kommen automatisch.</p>
    </section>

    <section class="ld-section">
      <h2>Häufige Fragen</h2>
      <details><summary>Kostet das etwas?</summary><p>Nein. Kein Abo, keine Werbung, kein Konto.</p></details>
      <details><summary>Wo liegen meine Daten?</summary><p>Nur auf deinem Handy. Die App macht täglich automatisch eine Sicherung und erinnert dich, eine Kopie in iCloud Drive zu speichern.</p></details>
      <details><summary>Bekomme ich neue Funktionen?</summary><p>Ja, automatisch. Beim Öffnen lädt die App neue Versionen selbst – deine Daten bleiben erhalten.</p></details>
      <details><summary>Bekomme ich Mitteilungen?</summary><p>Wenn du willst: In den Einstellungen einschalten, dann meldet sich die App 10 Sekunden vor Ende jeder Pause (ab iOS 16.4).</p></details>
      <details><summary>Was sieht ein Freund von mir?</summary><p>Nur deinen Namen und Kennzahlen wie Trainings, Streak, Volumen und Kraftwerte – keine einzelnen Workouts.</p></details>
    </section>

    <footer class="ld-foot">
      <button class="text-btn" data-web>Ohne Installation im Browser ausprobieren</button>
    </footer>`;

  root.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      try { await navigator.clipboard.writeText(c.dataset.copy); flash(c, 'Kopiert'); } catch { prompt('Kopieren:', c.dataset.copy); }
    }
    if (e.target.closest('[data-web]')) {
      try { localStorage.setItem('gym.web', '1'); } catch { /* egal */ }
      location.href = shortInvite ? `${SHARE_BASE}/f/${shortInvite}?app` : `${appUrl}?app${location.hash}`;
    }
  });

  // Android/Chrome: echter Installieren-Knopf, wenn der Browser es anbietet
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    const b = root.querySelector('.ld-install');
    if (b) { b.hidden = false; b.onclick = () => deferred.prompt(); }
  });
}

function flash(el, text) {
  const old = el.innerHTML;
  el.textContent = text;
  setTimeout(() => { el.innerHTML = old; }, 1400);
}

// Eigene Styles nur für diese Seite
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/landing.css';
document.head.appendChild(link);
render();
