// =============================================================
// search.js – unscharfe Übungssuche
//
// Bewertung pro Übung (Name + Synonyme), höchster Treffer zählt:
//   100  Anfang passt ("bank" -> "Bankdrücken")
//    90  ein Wort beginnt so ("press" -> "Bench Press")
//    80  irgendwo enthalten
//    75  alle Suchwörter kommen vor ("rudern kabel")
//   <60  Tippfehler-Toleranz über Editierdistanz (Damerau-Levenshtein)
// =============================================================

/** Kleinbuchstaben, Umlaute auflösen, Sonderzeichen -> Leerzeichen. */
export function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Editierdistanz inkl. Buchstabendreher (Optimal String Alignment). */
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function scoreString(q, qTokens, qc, s) {
  const n = norm(s);
  const nc = n.replace(/ /g, '');
  const words = n.split(' ');
  if (nc.startsWith(qc)) return 100;
  if (qTokens.length === 1 && words.some((w) => w.startsWith(q))) return 90;
  if (nc.includes(qc)) return 80;
  if (qTokens.length > 1 && qTokens.every((t) => nc.includes(t))) return 75;

  // Tippfehler: Suchbegriff mit Wortanfängen vergleichen
  const maxD = qc.length <= 3 ? 0 : qc.length <= 6 ? 1 : 2;
  if (!maxD) return 0;
  let best = Infinity;
  let pos = 0;
  const starts = words.map((w) => { const p = pos; pos += w.length; return p; });
  for (const st of starts) {
    for (let len = qc.length - 1; len <= qc.length + 1; len++) {
      if (st + len > nc.length + 1) continue;
      best = Math.min(best, editDistance(qc, nc.substr(st, len)));
    }
  }
  // Mehrere Wörter: jedes Wort einzeln tolerant suchen
  if (best > maxD && qTokens.length > 1) {
    const ok = qTokens.every((t) => t.length <= 3 ? nc.includes(t) : words.some((w) => editDistance(t, w.slice(0, t.length)) <= 1));
    if (ok) return 55;
  }
  return best <= maxD ? 60 - best * 10 : 0;
}

/** Übungen nach Relevanz filtern/sortieren. Leere Suche -> alphabetisch. */
export function searchExercises(query, list) {
  const q = norm(query);
  if (!q) return [...list].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const qTokens = q.split(' ');
  const qc = q.replace(/ /g, '');
  const scored = [];
  for (const ex of list) {
    let best = scoreString(q, qTokens, qc, ex.name) + 3; // Name leicht bevorzugt
    if (best === 3) best = 0;
    for (const a of ex.aliases || []) best = Math.max(best, scoreString(q, qTokens, qc, a));
    if (best > 0) scored.push({ ex, score: best });
  }
  scored.sort((a, b) => b.score - a.score || a.ex.name.length - b.ex.name.length || a.ex.name.localeCompare(b.ex.name, 'de'));
  return scored.map((s) => s.ex);
}
