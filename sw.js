/* Service Worker für die Web-App: macht die Seite installierbar und hält sie offline benutzbar.
   Strategie: Netzwerk zuerst (so kommen neue Versionen sofort an), bei Ausfall der Zwischenspeicher.
   Fremde Bibliotheken (three.js, PeerJS, Schriften) werden beim ersten Laden gemerkt. Netz-Verbindungen für Mehrspieler laufen unberührt. */
var CORE = 'html-games-core-v1', RUN = 'html-games-run-v1';
var SHELL = ['./', 'index.html', 'offline.html', 'theme.js', 'common.css', 'cyber.css', 'dark.css', 'net.js', 'net-config.js', 'icons/favicon.svg', 'icons/icon-192.png', 'icons/logo.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CORE && k !== RUN; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
var LIBS = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.(googleapis|gstatic)\.com)\//;
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    if (/version\.json$/.test(url.pathname)) return;                    // Versionsprüfung immer frisch (Netz), nie aus dem Speicher
    e.respondWith(networkFirst(req, req.mode === 'navigate'));
  } else if (LIBS.test(req.url)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});
function networkFirst(req, nav) {
  return fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(RUN).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (nav) return caches.match('offline.html').then(function (o) { return o || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); });
      return new Response('', { status: 504 });
    });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(RUN).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  });
}
