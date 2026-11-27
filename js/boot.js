// =============================================================
// boot.js – Start: App oder Startseite laden
// Vom Home-Bildschirm gestartet → App. Im Browser geöffnet → Startseite mit Anleitung.
// "?app" oder einmal "Im Browser ausprobieren" gewählt → App auch im Browser.
// (Eigene Datei statt Inline-Skript, damit die Content-Security-Policy keine
//  Inline-Skripte erlauben muss.)
// =============================================================

let web = false;
try { web = localStorage.getItem('gym.web') === '1'; } catch { /* Privatmodus */ }
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const mod = standalone || web || new URLSearchParams(location.search).has('app') ? './app.js' : './landing.js';

import(mod).catch((e) => {
  // Nie schwarzer Bildschirm: Fehler sichtbar machen
  const box = document.getElementById('app');
  box.innerHTML = '<div style="padding:60px 24px;text-align:center;font-family:-apple-system,sans-serif;color:#fff">'
    + '<h2 style="margin-bottom:10px">Seite konnte nicht geladen werden</h2><p style="color:#a9bac4;margin-bottom:20px">Bitte neu laden. Hilft das nicht, Safari schließen und den Link erneut öffnen.</p>'
    + '<button id="bootReload" style="font:inherit;padding:12px 24px;border-radius:999px;border:0;background:#8a3342;color:#fff">Neu laden</button>'
    + '<p id="bootErr" style="color:#5f6b72;font-size:12px;margin-top:24px"></p></div>';
  document.getElementById('bootErr').textContent = String((e && e.message) || e);
  document.getElementById('bootReload').addEventListener('click', () => location.reload());
});
