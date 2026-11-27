// Offline-Fähigkeit: erst Netz (lokaler Server), sonst Kopie aus dem Cache.
const CACHE = 'dbt-tagebuch-v20';
const SHELL = ['./', 'index.html', 'style.css', 'bericht.css','js/app.js', 'js/kern.js', 'js/erinnerung.js', 'js/notfall.js', 'js/felder.js', 'js/eintrag.js', 'js/draenge.js', 'js/karte.js', 'js/vorlage.js', 'js/hilfe.js', 'js/pdf.js', 'js/einstellungen.js', 'js/woche.js', 'js/db.js', 'js/model.js', 'js/defaults.js', 'js/bericht.js', 'js/ui.js', 'js/ketten.js', 'js/sicherheit.js', 'js/design.js', 'js/uebungen.js', 'js/plattform.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
