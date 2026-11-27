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
  { id: 'drinkscan', title: 'Energy-Drinks scannen', text: 'Dose scannen – Name, Menge und Koffein werden übernommen und gemerkt.', where: 'Freunde → Energy-Drinks → „+ Drink“' },
  { id: 'live', title: 'Sehen, wer gerade trainiert', text: 'Oben bei Freunde: wer im Gym ist, wann zuletzt – und an welchen Tagen und Uhrzeiten jemand meist trainiert (Freund antippen). Abschaltbar bei „Hinzufügen“.', where: 'Freunde' },
  { id: 'avatar', title: 'Profilbilder', text: 'Eigenes Foto wählen – Freunde sehen es in der Leiste und in der Rangliste.', where: 'Freunde → „Hinzufügen“' },
];

const KEY = 'gym.newsSeen';
const HIDE = 'gym.newsHidden';
const load = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const store = (k, set) => { try { localStorage.setItem(k, JSON.stringify([...set])); } catch { /* privat-Modus */ } };

/** Sichtbare Neuheiten (nicht selbst gelöscht), neueste zuerst. */
export const visibleNews = () => { const h = load(HIDE); return NEWS.filter((n) => !h.has(n.id)).reverse(); };
/** Ungesehen = noch nicht auf „Gesehen“ gedrückt und nicht gelöscht. Nur dann roter Punkt. */
export const unseen = () => { const s = load(KEY), h = load(HIDE); return NEWS.filter((n) => !s.has(n.id) && !h.has(n.id)); };
export const hasUnseen = () => unseen().length > 0;

/** Einen (id) oder alle Einträge als gesehen markieren – nur auf Knopfdruck. */
export function markSeen(id = null) {
  const s = load(KEY);
  for (const n of NEWS) if (!id || n.id === id) s.add(n.id);
  store(KEY, s);
}
/** Eintrag löschen (nur auf diesem Gerät, gilt auch als gesehen). */
export function hideNews(id) {
  const h = load(HIDE); h.add(id); store(HIDE, h);
  markSeen(id);
}
