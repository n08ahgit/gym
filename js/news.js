// =============================================================
// news.js – „Neuheiten“ unter Einstellungen
//
// Jede neue Funktion bekommt hier EINE kurze Zeile: was sie macht und
// wo man sie findet. In der Reihenfolge, in der sie erschienen sind
// (neueste unten anhängen, id nie ändern).
// Ungelesene → roter Punkt am Tab „Einstellungen“; gelesen, sobald die
// Einstellungen geöffnet werden (gespeichert pro Gerät).
// =============================================================

export const NEWS = [
  { id: 'rhythmus', title: 'Trainingsrhythmus statt fester Woche', text: 'z. B. Push · Pull · Beine · Pause im Kreis – egal welcher Wochentag ist.', where: 'Training → „Plan-Art“' },
  { id: 'feedback', title: 'Verbesserungsvorschläge', text: 'Schreib, was fehlt oder besser werden soll – jeder Vorschlag wird gelesen.', where: 'Einstellungen → „Verbesserungsvorschlag“' },
  { id: 'supps', title: 'Supplement-Erinnerung', text: 'Uhrzeit, Wiederholung und Hinweis wählen, auf Wunsch stündlich bis zum Abhaken. Mit Tipps über das i.', where: 'Ernährung → „Supplements“' },
  { id: 'barcode', title: 'Barcode-Scanner & eigene Zutaten', text: 'Packung scannen oder Zutat selbst anlegen – bleibt in deiner Liste. Bitte möglichst scannen: Gescanntes können danach alle Nutzer finden.', where: 'Ernährung → „Essen eintragen“' },
  { id: 'wiegen', title: 'Erinnerung zum Wiegen', text: 'Uhrzeit und Tage wählen – abgehakt wird automatisch, sobald du dein Gewicht einträgst.', where: 'Fortschritt → Körpergewicht → Glocke' },
];

const KEY = 'gym.newsSeen';

function seen() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}

export const unseen = () => { const s = seen(); return NEWS.filter((n) => !s.has(n.id)); };
export const hasUnseen = () => unseen().length > 0;

export function markSeen() {
  try { localStorage.setItem(KEY, JSON.stringify(NEWS.map((n) => n.id))); } catch { /* privat-Modus: dann eben jedes Mal */ }
}
