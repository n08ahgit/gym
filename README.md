# Gym – Fitness-Tracker (PWA)

Trainingsplan, Workout-Modus mit Pausen-Timer und Jahresübersicht. Reines HTML/CSS/JS, kein Server, läuft offline. Daten bleiben auf dem Gerät.

## Veröffentlichen auf GitHub Pages (am PC)
1. **github.com** öffnen → oben rechts **+** → **New repository**.
2. Name: `gym` · **Public** auswählen · **Create repository**.
3. Auf der leeren Repo-Seite auf **„uploading an existing file“** klicken.
4. Den **Inhalt** dieses Ordners (`index.html`, `manifest.json`, `sw.js`, Ordner `css`, `js`, `icons`, `img`) ins Browserfenster ziehen. `README.md` ist optional.
   Wichtig: `index.html` muss ganz oben im Repo liegen, nicht in einem Unterordner.
5. Unten **Commit changes** klicken.
6. Im Repo: **Settings** → links **Pages** → bei *Source* **Deploy from a branch** → Branch **main**, Ordner **/ (root)** → **Save**.
7. 1–2 Minuten warten, Seite neu laden. Oben steht dann die Adresse:
   `https://DEIN-GITHUB-NAME.github.io/gym/`

## Auf dem iPhone installieren
1. Den Link in **Safari** öffnen (nicht Chrome/Instagram-Browser).
2. Unten **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Ab jetzt immer über das **Icon** starten. Die App-Daten sind getrennt von den Daten im Safari-Tab.

Freunde: Link schicken, gleiche Schritte. Jeder hat automatisch seine eigenen Daten (alles lokal).

## Freunde-Rangliste (ohne Server)
- Tab **Freunde** → Namen eintragen → **Stand teilen** → Link per WhatsApp/iMessage schicken.
- Öffnet der Freund den Link, erscheinst du in seiner Rangliste. Schickt er seinen Link zurück, erscheint er in deiner.
- Wertungen: Konstanz (Trainings in 4 Wochen), Streak, Volumen (4 Wochen), Kraft (Bank + Kniebeuge + Kreuzheben ÷ Körpergewicht).
- Ehrlich: Ohne Server aktualisiert sich ein Stand nur, wenn jemand seinen Link neu schickt. Geteilt werden nur Name und Kennzahlen.
- Den Link nur in der installierten App öffnen (Safari-Tab und Home-Bildschirm-App haben getrennte Daten). Alternativ Code im Tab Freunde einfügen.

## Trainingsvorschläge (evidenzbasiert, Muskelaufbau)
- **Steigerung:** doppelte Progression – Wdh. im Zielbereich steigern; schaffst du das obere Ende in allen Sätzen, Gewicht hoch (Langhantel +2,5 kg, große Beinübungen +5 kg, Kurzhantel +2 kg). Zweimal unter dem Bereich → ca. 10 % leichter.
- **Bereiche:** schwere Grundübungen 6–10, Mehrgelenk 8–12, Isolation 10–15, kleine Muskeln 12–20 Wdh.; 1–3 Wdh. vor dem Versagen; Pausen 2–4 min (Grundübungen) bzw. 1–2 min; 10–20 harte Sätze pro Muskel/Woche.
- Quellen: Schoenfeld 2017 (Volumen), Refalo 2023 & Robinson 2024 (Nähe zum Versagen), Pelland 2024 (Dosis-Wirkung), Schoenfeld 2016 (Pausen), Wolf 2025 / Maeo (gedehnte Position), Iraki 2019 (Gewichtszunahme 0,25–0,5 %/Woche).

## Pausen-Mitteilung (Push)
Verlässt du die App während einer Pause, kommt 10 Sekunden vor dem Pausenende eine Mitteilung – auch bei gesperrtem iPhone. Bist du in der App, piept sie wie bisher.
Live-Aktivitäten / Dynamic Island gibt es für Web-Apps nicht (nur App-Store-Apps).

**Voraussetzungen:** iOS 16.4+, App über GitHub Pages vom Home-Bildschirm gestartet, ein kostenloser Cloudflare-Account für den Wecker-Server (`push-server/`).

**Server einrichten (einmalig, am PC mit Node.js):**
1. `cd push-server` · `node keys.mjs` → zwei Schlüssel.
2. `VAPID_PUBLIC` in `wrangler.toml` und in `js/push-config.js` eintragen.
3. `npx wrangler login` · `npx wrangler secret put VAPID_PRIVATE_JWK` (privaten Schlüssel einfügen) · `npx wrangler deploy`.
4. Die angezeigte Adresse (`https://gym-push.DEIN-NAME.workers.dev`) in `js/push-config.js` bei `PUSH_SERVER` eintragen, App neu hochladen, `CACHE` in `sw.js` hochzählen.
5. In der App: Einstellungen → **Mitteilungen einschalten** → **Test in 10 Sekunden**.

Kosten: 0 € (Cloudflare Free: 100.000 Anfragen/Tag). Gespeichert wird nur die Push-Adresse des Geräts und der Text der nächsten Mitteilung.

## Datensicherung
- **Automatisch:** täglich ein Schnappschuss auf dem iPhone (IndexedDB), 14 Tage. Wiederherstellen unter Einstellungen → Datensicherung.
- **Datei (iCloud Drive):** iOS erlaubt Web-Apps kein unbemerktes Speichern von Dateien. Die App erinnert deshalb alle 7 Tage; ein Tipp öffnet „In Dateien sichern“.

## Updates
Neue Version = Dateien hier ins Repo + `CACHE` in `sw.js` hochzählen. Jede installierte App findet das Update beim nächsten Öffnen oder Zurückkehren selbst und lädt es sofort (während eines Workouts erst danach). Daten bleiben erhalten.

## Update einspielen (manuell)
1. Geänderte Dateien im Repo hochladen (gleiche Namen = ersetzen).
2. In `sw.js` die Zeile `const CACHE = 'gym-v1';` hochzählen (`gym-v2`, …) – sonst bleibt die alte Version im Cache.
3. App auf dem iPhone 1–2× schließen und öffnen.

## Ehrliche Grenzen (iOS)
- **Ton am Pausenende** kommt nur, wenn die App offen ist und das iPhone nicht auf lautlos steht. Gesperrter Bildschirm oder andere App → iOS pausiert die Web-App, kein Ton. Deshalb hält die App während des Workouts den Bildschirm an (Wake Lock, in Home-Bildschirm-Apps zuverlässig ab iOS 18.4).
- Der Timer selbst stimmt immer (End-Zeitstempel): App zu → wieder auf → richtige Restzeit bzw. direkt die nächste Übung.
- **Daten liegen nur auf dem Gerät.** Die automatischen Schnappschüsse schützen vor Fehlbedienung, nicht vor Verlust des iPhones → die Erinnerung zur Datei-Sicherung ernst nehmen.
- Keine Vibration (gibt es in iOS-Web-Apps nicht).

## Dateistruktur
| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst, iOS-/PWA-Meta-Tags |
| `manifest.json` | App-Name, Icons, Farben |
| `sw.js` | Service Worker (offline, Cache-Version) |
| `css/style.css` | Design; Akzentfarbe = `--accent` |
| `js/app.js` | Start, Navigation, Klick-Verteilung, Timer-Takt, Wake Lock |
| `js/store.js` | Datenmodell + Speichern (localStorage), Export/Import |
| `js/exercises.js` | Muskelgruppen + ~100 Übungen (neue einfach als Zeile ergänzen) |
| `js/search.js` | Unscharfe Suche (Tippfehler-tolerant) |
| `js/bodyimage.js` + `img/body/` | Körperbild (OpenAI-Bildmodell) + 18 Muskel-Masken, Färbung per CSS |
| `js/audio.js` | Ton über Web Audio |
| `js/year.js` | Jahresraster + Tagesstatus |
| `js/coach.js` | Steigerungsvorschlag, Wdh.-Bereiche, Pausen, Scheibenrechner, Rekorde, Gewichtstrend |
| `js/tips.js` | Ausführungstipps für alle Übungen |
| `js/friends.js` | Freundes-Links (Kodierung), Ranglisten |
| `js/backup.js` | Automatische Schnappschüsse + Datei-Sicherung |
| `js/record.js` | Dezenter Rekord-Hinweis |
| `js/push.js` + `js/push-config.js` | Pausen-Mitteilung: bestellen/abbestellen beim Push-Server |
| `push-server/` | Cloudflare Worker (Wecker pro Gerät, Web Push mit VAPID) – nicht auf GitHub Pages hochladen |
| `js/screens/*.js` | Bildschirme: Home, Plan-Editor/Suche, Workout, Fortschritt, Freunde, Einstellungen, Übungs-Info |

## Datenmodell (Kurzfassung)
- `planVersions`: `[{ from: "2026-11-24", days: [Mo…So] }]` – jede Planänderung erzeugt eine Version ab heute. Alte Tage nutzen die damals gültige Version → keine nachträgliche Umfärbung.
- `sessions`: gespeicherte Workouts mit Sätzen (`w` kg, `r` Wdh, `status` done/skipped).
- `customExercises`: eigene Übungen.
- `body`: Körpergewicht pro Tag · `profile`: Name + Kennung · `friends`: zuletzt erhaltener Stand · `settings.bar`: Stangengewicht.
- Laufendes Workout separat (`gym.active.v1`), wird bei jeder Aktion gespeichert; Pausen als End-Zeitstempel.

## Lokal testen (optional)
Im Ordner `python3 -m http.server 8000` ausführen und `http://localhost:8000` öffnen. (Direkt per Doppelklick auf `index.html` geht nicht – Module und Service Worker brauchen einen Webserver.)
