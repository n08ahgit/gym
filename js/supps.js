// =============================================================
// supps.js – Supplement-Erinnerungen
//
// Eintrag: Name, Menge, Uhrzeit, Wiederholung (täglich / Wochentage /
// alle N Tage / einmalig), Hinweis (z. B. „zum Abendessen“) und optional
// „stündlich nachfragen, bis abgehakt“.
//
// Die Mitteilungen verschickt der Push-Server (die App ist ja meist zu):
// Die App schickt ihm die Liste + Zeitzone (POST /supp/set) und meldet
// jedes Abhaken (POST /supp/done). Der Server stellt seinen Wecker immer
// auf die nächste fällige Erinnerung und fragt bei „nag“ jede Stunde nach,
// bis abgehakt wird (spätestens bis Mitternacht).
//
// Tipps: Stand der Forschung bzw. offizielle Empfehlungen (ISSN, DGE,
// BfR, EFSA). Keine Heilversprechen – bei Medikamenten/Erkrankungen
// Arzt oder Apotheke fragen.
// =============================================================

import { data, save } from './store.js';
import { dateStr, parseDate, uid, weekdayIdx } from './util.js';
import { PUSH_SERVER } from './push-config.js';

export const HINTS = ['zum Frühstück', 'zum Mittagessen', 'zum Abendessen', 'mit fetthaltiger Mahlzeit', 'nüchtern', 'vor dem Training', 'nach dem Training', 'vor dem Schlafen', 'mit viel Wasser'];

const GENERAL = [
  'Supplements ergänzen eine gute Ernährung – sie ersetzen sie nicht. Erst Essen, Schlaf und Training im Griff haben.',
  'Auf geprüfte Produkte achten (z. B. „Kölner Liste“ für Sportler) – Nahrungsergänzungsmittel werden vor dem Verkauf nicht amtlich geprüft.',
  'Nimmst du Medikamente oder hast eine Erkrankung: vorher mit Arzt oder Apotheke abklären.',
];

/**
 * Bekannte Supplements: Suchbegriffe, Vorschläge (Menge, Uhrzeit, Hinweis) und Tipps.
 */
export const CATALOG = [
  { key: 'kreatin', name: 'Kreatin', match: /kreatin|creatin/i, dose: '5 g', time: '18:00', hint: 'zum Abendessen',
    tips: [
      'Am besten untersucht: Kreatin-Monohydrat. 3–5 g täglich reichen (ISSN-Positionspapier).',
      'Die Uhrzeit ist fast egal – entscheidend ist, es jeden Tag zu nehmen, auch an Pausetagen. Mit einer Mahlzeit ist es am leichtesten zur Gewohnheit zu machen.',
      'Ladephase (ca. 20 g/Tag, verteilt, 5–7 Tage) ist optional: Speicher sind schneller voll, nach 3–4 Wochen ist man mit 3–5 g aber gleich weit.',
      '1–2 kg mehr auf der Waage am Anfang sind Wasser im Muskel – normal und kein Fett.',
      'Für Gesunde gilt es als sicher. Genug trinken.',
    ] },
  { key: 'whey', name: 'Whey / Proteinpulver', match: /whey|protein|eiwei/i, dose: '30 g', time: '17:00', hint: 'nach dem Training',
    tips: [
      'Proteinpulver ist einfach Essen in praktischer Form – sinnvoll, wenn du dein Tagesziel (ca. 1,6–2,2 g pro kg Körpergewicht) sonst nicht schaffst.',
      'Wichtiger als der genaue Zeitpunkt ist die Tagesmenge. Gut: über den Tag 3–5 Portionen mit je 20–40 g Protein.',
      'Trag den Shake in der App unter „Essen eintragen“ ein, dann zählt er zu deinen Makros.',
    ] },
  { key: 'vitd', name: 'Vitamin D3', match: /vitamin\s*d|vit\.?\s*d|d3/i, dose: '20 µg (800 IE)', time: '08:00', hint: 'mit fetthaltiger Mahlzeit',
    tips: [
      'In Deutschland bildet die Haut von etwa Oktober bis März kaum Vitamin D – da kann ein Präparat sinnvoll sein.',
      'DGE: 20 µg (800 IE) pro Tag, wenn die eigene Bildung fehlt. Das BfR empfiehlt für Nahrungsergänzung höchstens 20 µg pro Tag.',
      'Fettlöslich → zu einer Mahlzeit mit etwas Fett nehmen, dann wird es besser aufgenommen.',
      'Hohe Dosen nur nach Blutwert und mit Arzt – zu viel Vitamin D kann schaden.',
    ] },
  { key: 'omega3', name: 'Omega-3 (Fischöl)', match: /omega|fisch[öo]l|epa|dha|algen[öo]l/i, dose: '1 Kapsel', time: '13:00', hint: 'zum Mittagessen',
    tips: [
      'Wer 1–2× pro Woche fetten Seefisch isst (Lachs, Hering, Makrele), braucht meist kein Präparat.',
      'Für die allgemeine Gesundheit nennt die EFSA ca. 250 mg EPA + DHA pro Tag – auf die EPA/DHA-Menge achten, nicht nur auf „Fischöl“.',
      'Zu einer Mahlzeit nehmen: bessere Aufnahme und weniger Fischaufstoßen.',
      'Vegane Alternative: Algenöl.',
    ] },
  { key: 'magnesium', name: 'Magnesium', match: /magnes/i, dose: '200 mg', time: '21:00', hint: 'zum Abendessen',
    tips: [
      'Bei normaler Ernährung meist nicht nötig – sinnvoll bei nachgewiesenem Mangel oder wenn du kaum Vollkorn, Nüsse und Hülsenfrüchte isst.',
      'BfR: aus Nahrungsergänzung höchstens 250 mg pro Tag, am besten auf zwei Portionen verteilt.',
      'Zu viel auf einmal kann Durchfall machen. Citrat oder Glycinat werden meist gut vertragen.',
      'Gegen Muskelkrämpfe ist die Wirkung bei Gesunden wissenschaftlich kaum belegt.',
    ] },
  { key: 'zink', name: 'Zink', match: /zink|zinc/i, dose: '5 mg', time: '20:00', hint: 'zum Abendessen',
    tips: [
      'Nur bei Mangel sinnvoll (z. B. sehr wenig Fleisch/Käse/Vollkorn). Zu viel Zink über lange Zeit stört die Kupfer-Aufnahme.',
      'BfR: in Nahrungsergänzung höchstens 6,5 mg pro Tag.',
      'Nicht zusammen mit Eisen oder Calcium nehmen – die behindern sich gegenseitig. Nüchtern kann es Übelkeit machen → zu einer Mahlzeit.',
    ] },
  { key: 'eisen', name: 'Eisen', match: /eisen|iron|ferr/i, dose: '1 Tablette', time: '09:00', hint: 'nüchtern',
    tips: [
      'Nur nach Bluttest (Ferritin) und ärztlicher Empfehlung – zu viel Eisen ist schädlich.',
      'Mit Vitamin C (z. B. Orangensaft) wird es besser aufgenommen; Kaffee, Tee, Milch und Calcium hemmen die Aufnahme – 1–2 h Abstand.',
      'Jeden zweiten Tag statt täglich kann laut Studien zu besserer Aufnahme führen – mit dem Arzt absprechen.',
    ] },
  { key: 'koffein', name: 'Koffein / Pre-Workout', match: /koffein|caffein|pre.?workout|booster/i, dose: '200 mg', time: '16:30', hint: 'vor dem Training',
    tips: [
      'Wirkt leistungssteigernd bei 3–6 mg pro kg Körpergewicht, oft reichen schon 2–3 mg/kg (ISSN). Meist ca. 60 min vor dem Training.',
      'EFSA: bis 200 mg auf einmal und 400 mg pro Tag gelten für Erwachsene als unbedenklich – Energy-Drinks und Kaffee mitzählen (siehe Koffein-Zähler bei Freunde).',
      'Koffein wirkt viele Stunden nach: spätestens ca. 6–8 h vor dem Schlafen, sonst leidet die Erholung.',
    ] },
  { key: 'betaalanin', name: 'Beta-Alanin', match: /beta.?alanin/i, dose: '1,6 g', time: '08:00', hint: 'zum Frühstück',
    tips: [
      'Hilft vor allem bei harten Belastungen von ca. 1–4 Minuten (z. B. hohe Wiederholungszahlen, Sprints) – für reinen Muskelaufbau eher wenig.',
      'Wirkt erst nach Wochen täglicher Einnahme (ca. 3–6 g/Tag), nicht akut vor dem Training.',
      'Das Kribbeln auf der Haut ist harmlos – kleinere Portionen über den Tag verteilt verringern es.',
    ] },
  { key: 'citrullin', name: 'Citrullin', match: /citrull/i, dose: '6 g', time: '16:30', hint: 'vor dem Training',
    tips: [
      'Studien sind gemischt – wenn überhaupt, ein kleiner Effekt auf Wiederholungen bzw. Pump.',
      'Meist 6–8 g Citrullin-Malat ca. 60 min vor dem Training.',
    ] },
  { key: 'b12', name: 'Vitamin B12', match: /b.?12|cobalamin/i, dose: '1 Tablette', time: '08:00', hint: 'zum Frühstück',
    tips: [
      'Bei veganer Ernährung unverzichtbar, bei vegetarischer oft sinnvoll. Wer Fleisch, Fisch, Eier und Milch isst, braucht es normalerweise nicht.',
      'Am besten den Wert ab und zu beim Arzt prüfen lassen.',
    ] },
  { key: 'multi', name: 'Multivitamin', match: /multi/i, dose: '1 Tablette', time: '08:00', hint: 'zum Frühstück',
    tips: [
      'Bei abwechslungsreicher Ernährung meist unnötig – Obst, Gemüse und Vollkorn bringen mehr.',
      'Nicht mehrere Präparate mit denselben Vitaminen kombinieren, sonst wird es schnell zu viel.',
    ] },
  { key: 'ashwa', name: 'Ashwagandha', match: /ashwa|schlafbeere/i, dose: '1 Kapsel', time: '21:00', hint: 'zum Abendessen',
    tips: [
      'Studien zeigen teils kleine Effekte auf Stress und Schlaf, die Datenlage ist aber dünn.',
      'Das BfR warnt (2024): Es gibt Berichte über Leberschäden; Kinder, Schwangere, Stillende und Menschen mit Lebererkrankungen sollen es meiden.',
      'Wechselwirkungen u. a. mit Schilddrüsen-, Blutdruck- und Diabetesmedikamenten möglich – im Zweifel weglassen bzw. Arzt fragen.',
    ] },
  { key: 'elektrolyte', name: 'Elektrolyte', match: /elektrolyt|electrolyt|salz/i, dose: '1 Portion', time: '16:30', hint: 'mit viel Wasser',
    tips: [
      'Nur bei langen, schweißtreibenden Einheiten (über ca. 1 h, Hitze, Fußball) sinnvoll – sonst reicht normales Essen.',
      'Wichtigster Bestandteil ist Natrium.',
    ] },
  { key: 'kollagen', name: 'Kollagen', match: /kollagen|collagen|gelatine/i, dose: '10 g', time: '16:00', hint: 'vor dem Training',
    tips: [
      'Zählt nicht als vollwertiges Protein für den Muskelaufbau (unvollständiges Aminosäureprofil).',
      'Für Sehnen/Gelenke gibt es erste Hinweise: ca. 10–15 g mit etwas Vitamin C 30–60 min vor Belastung. Die Belege sind noch schwach.',
    ] },
];

/** Passenden Katalog-Eintrag zu einem (frei getippten) Namen finden. */
export const catalogFor = (name) => CATALOG.find((c) => c.match.test(name || '')) || null;

/** Tipps zu einem Supplement (bekannte + allgemeine). */
export function tipsFor(name) {
  const c = catalogFor(name);
  return { known: c, tips: c ? c.tips : [], general: GENERAL };
}

// ---------- Plan ----------

const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

/** Ist der Eintrag an diesem Tag fällig? */
export function isDue(s, ds) {
  const r = s.rep || { type: 'daily' };
  if (r.start && ds < r.start) return false;
  if (r.type === 'days') return (r.days || []).includes(weekdayIdx(parseDate(ds)));
  if (r.type === 'every') return daysBetween(r.start || ds, ds) % Math.max(1, r.n || 1) === 0;
  if (r.type === 'once') return ds === r.start;
  return true;
}

export const supps = () => data.supps || [];
export const dueOn = (ds = dateStr()) => supps().filter((s) => isDue(s, ds)).sort((a, b) => a.time.localeCompare(b.time));
export const isDone = (id, ds = dateStr()) => (data.suppDone?.[ds] || []).includes(id);

/** Text zur Wiederholung, z. B. „Täglich“, „Mo, Mi, Fr“, „Alle 2 Tage“. */
export function repText(s) {
  const r = s.rep || { type: 'daily' };
  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  if (r.type === 'days') return (r.days || []).length === 7 ? 'Täglich' : (r.days || []).slice().sort().map((d) => WD[d]).join(', ');
  if (r.type === 'every') return r.n > 1 ? `Alle ${r.n} Tage` : 'Täglich';
  if (r.type === 'once') return 'Einmalig';
  return 'Täglich';
}

export function saveSupp(s) {
  data.supps = supps().filter((x) => x.id !== s.id);
  data.supps.push({ ...s, id: s.id || uid() });
  save();
  syncSupps();
}

export function deleteSupp(id) {
  data.supps = supps().filter((x) => x.id !== id);
  save();
  syncSupps();
}

/** Abhaken / zurücknehmen. Rückgabe: neuer Zustand. */
export function toggleDone(id, ds = dateStr()) {
  const list = new Set(data.suppDone?.[ds] || []);
  const done = !list.has(id);
  if (done) list.add(id); else list.delete(id);
  data.suppDone = { ...(data.suppDone || {}), [ds]: [...list] };
  save();
  postServer('/supp/done', { date: ds, id, done });
  return done;
}

// ---------- Erinnerung zum Wiegen ----------
// Läuft über dieselbe Server-Logik wie die Supplements (Eintrag "weigh").
// Abgehakt wird automatisch, sobald das Gewicht des Tages eingetragen ist.

export const weighRem = () => data.settings.weighRem || null;
export function setWeighRem(cfg) {
  data.settings.weighRem = cfg;
  save();
  syncSupps();
}
/** Gewicht für diesen Tag eingetragen → Erinnerung erledigt (keine Nachfragen mehr). */
export function markWeighed(ds = dateStr()) {
  if (weighRem()?.on && !isDone('weigh', ds)) toggleDone('weigh', ds);
}
export const remindersOn = () => supps().length > 0 || !!weighRem()?.on;

// ---------- Server ----------

function pushSub() {
  try { return JSON.parse(localStorage.getItem('gym.push') || 'null')?.sub || null; } catch { return null; }
}

function postServer(path, body) {
  const sub = pushSub();
  if (!sub || !PUSH_SERVER) return Promise.resolve(null);
  return fetch(PUSH_SERVER.replace(/\/$/, '') + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, endpoint: sub.endpoint, sub }), keepalive: true,
  }).catch(() => null);
}

/** Liste + Zeitzone + heute Abgehaktes an den Server schicken. */
export function syncSupps() {
  const today = dateStr();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  return postServer('/supp/set', {
    tz,
    items: [
      ...supps().map(({ id, name, dose, time, rep, hint, nag }) => ({ id, name, dose, time, rep, hint, nag: !!nag })),
      ...(weighRem()?.on ? [{ id: 'weigh', kind: 'weigh', name: 'Wiegen', dose: '', hint: 'morgens nach dem Klo, vor dem Frühstück', time: weighRem().time, rep: weighRem().rep, nag: !!weighRem().nag }] : []),
    ],
    done: { [today]: data.suppDone?.[today] || [] },
  });
}

/** Am Handy (Android) per Mitteilung abgehakt? → hier übernehmen. */
export async function pullSuppDone() {
  if (!supps().length) return false;
  const res = await postServer('/supp/get', {});
  if (!res?.ok) return false;
  const d = await res.json().catch(() => null);
  let changed = false;
  for (const [ds, ids] of Object.entries(d?.done || {})) {
    const cur = new Set(data.suppDone?.[ds] || []);
    for (const id of ids) if (!cur.has(id)) { cur.add(id); changed = true; }
    if (changed) data.suppDone = { ...(data.suppDone || {}), [ds]: [...cur] };
  }
  if (changed) save();
  return changed;
}
