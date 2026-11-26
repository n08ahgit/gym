// =============================================================
// sw.js – Service Worker: macht die App offline nutzbar
//
// WICHTIG nach jeder Code-Änderung: CACHE-Version hochzählen
// (z. B. 'gym-v2'), sonst lädt das iPhone weiter die alte Version.
// Die App sucht bei jedem Öffnen/Zurückkehren nach Updates und lädt
// eine neue Version sofort (während eines Workouts erst danach).
// =============================================================

const CACHE = 'gym-v54';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/landing.css',
  './js/landing.js',
  './img/landing/home.webp',
  './img/landing/workout.webp',
  './img/landing/progress.webp',
  './img/landing/friends.webp',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/exercises.js',
  './js/search.js',
  './js/bodyimage.js',
  './js/stats.js',
  './js/demo.js',
  './js/streak.js',
  './js/celebrate.js',
  './js/charts.js',
  './js/push.js',
  './js/push-config.js',
  './js/coach.js',
  './js/tips.js',
  './js/backup.js',
  './js/friends.js',
  './js/drinks.js',
  './js/presets.js',
  './js/nutrition.js',
  './data/foods-ch.json',
  './js/screens/food.js',
  './js/record.js',
  './js/screens/friends.js',
  './js/screens/yearview.js',
  './js/screens/exinfo.js',
  './js/screens/progress.js',
  './js/screens/tabbar.js',
  './img/body/base.webp',
  './img/flame/orange.webp',
  './img/flame/red.webp',
  './img/flame/blue.webp',
  './img/body/chest.png',
  './img/body/front_delts.png',
  './img/body/side_delts.png',
  './img/body/rear_delts.png',
  './img/body/biceps.png',
  './img/body/triceps.png',
  './img/body/forearms.png',
  './img/body/abs.png',
  './img/body/obliques.png',
  './img/body/traps.png',
  './img/body/upper_back.png',
  './img/body/lats.png',
  './img/body/lower_back.png',
  './img/body/glutes.png',
  './img/body/quads.png',
  './img/body/hamstrings.png',
  './img/body/adductors.png',
  './img/body/calves.png',
  './js/audio.js',
  './js/year.js',
  './js/screens/icons.js',
  './js/screens/home.js',
  './js/screens/plan.js',
  './js/screens/workout.js',
  './js/supps.js',
  './js/news.js',
  './js/screens/suppui.js',
  './js/screens/sessionedit.js',
  './js/screens/setedit.js',
  './js/screens/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Installation: alle Dateien in den Cache laden
self.addEventListener('install', (e) => {
  // cache: 'reload' = immer frisch vom Server holen, nie aus dem Browser-Zwischenspeicher
  // (sonst landen beim Update evtl. alte Dateien im neuen Cache)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

// Aktivierung: alte Cache-Versionen löschen
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Anfragen: zuerst Cache (schnell + offline), sonst Netz
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});

// Push-Mitteilung (Pausenende) anzeigen
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Pause vorbei', {
    body: d.body || 'Weiter geht\'s',
    tag: d.tag || 'rest',
    renotify: true,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    // Supplement: auf Android direkt abhaken (iPhone zeigt keine Knöpfe)
    ...(d.supp ? { data: { supp: d.supp, server: d.server }, actions: [{ action: 'done', title: 'Erledigt ✓' }] } : {}),
  }));
});

// Antippen der Mitteilung → App öffnen bzw. nach vorne holen
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const sd = e.notification.data;
  if (e.action === 'done' && sd?.supp && sd.server) {
    e.waitUntil(self.registration.pushManager.getSubscription().then((sub) => sub && fetch(sd.server + '/supp/done', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, date: sd.supp.date, id: sd.supp.id, done: true }),
    })).catch(() => {}));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((w) => 'focus' in w);
    if (sd?.supp) {
      if (c) { c.postMessage({ go: 'food' }); return c.focus(); }
      return self.clients.openWindow('./?app&tab=food');
    }
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
