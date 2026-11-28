// =============================================================
// legalstatus.js – Sind die Rechtstexte fertig?
// Fertig = keine Entwurfs-Markierung (class="draft") und keine Platzhalter
// (class="ph") mehr. Entwürfe werden nicht öffentlich verlinkt; der Server
// verkauft nichts, solange ein Pflichttext noch Entwurf ist (shop.js).
// Ohne Abhängigkeiten, damit auch die Startseite es nutzen kann.
// =============================================================

export const LEGAL = {
  impressum: 'Impressum',
  datenschutz: 'Datenschutz',
  agb: 'AGB',
  widerruf: 'Widerrufsbelehrung',
  lizenzen: 'Lizenzen',
};

export const isFinal = (html) => !/class="(draft|ph)"/.test(html);

// Datenschutz und Lizenzen immer anzeigen (die App verarbeitet schon jetzt Daten) –
// auch wenn noch Kontaktangaben fehlen; Impressum/AGB/Widerruf erst, wenn fertig.
const ALWAYS = ['datenschutz', 'lizenzen'];
let cache = null;
export async function finalLegal() {
  if (cache) return cache;
  const out = {};
  await Promise.all(Object.keys(LEGAL).map(async (k) => {
    if (ALWAYS.includes(k)) { out[k] = true; return; }
    try { out[k] = isFinal(await (await fetch(`legal/${k}.html`)).text()); } catch { out[k] = false; }
  }));
  cache = out;
  return out;
}
