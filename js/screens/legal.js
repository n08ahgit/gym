// =============================================================
// legal.js – Impressum, Datenschutz, AGB, Widerrufsbelehrung, Lizenzen
// Die Texte liegen als eigene Seiten unter legal/*.html (auch direkt im
// Browser aufrufbar und Quelle für die Kauf-Bestätigungs-Mail).
// In der App erscheinen sie als Fenster – höchstens 2 Klicks entfernt.
// =============================================================

import { openSheet, toast } from '../app.js';

import { LEGAL } from '../legalstatus.js';
export { LEGAL, finalLegal, isFinal } from '../legalstatus.js';

export async function openLegal(name) {
  try {
    const html = await (await fetch(`legal/${name}.html`)).text();
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
    // Eigene, vertrauenswürdige Texte; Links zu legal/… relativ zum App-Ordner
    const body = main.replace(/href="(?!https?:|#|\.\.\/)([^"]+)"/g, 'href="legal/$1"').replace(/href="\.\.\/([^"]*)"/g, 'href="./$1"');
    openSheet(`<h2 class="sheet-title">${LEGAL[name] || 'Info'}</h2><div class="legal-body">${body}</div>`);
  } catch {
    toast('Konnte nicht geladen werden – bitte Internet prüfen');
  }
}
