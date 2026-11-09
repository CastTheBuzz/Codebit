// Codebit offline support. VERSION is stamped by deploy.bat so devices pick up updates.
const VERSION = 'dev';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/store.js', '/runner.js', '/course.json', '/vendor/editor.js', '/rt/py.worker.js', '/rt/js.worker.js', '/rt/sql.worker.js', '/rt/cc.worker.js', '/rt/exec.worker.js', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];
const APP = 'cb-app-' + VERSION, RT = 'cb-rt-1', FONTS = 'cb-fonts';
self.addEventListener('install', e => e.waitUntil((async () => {
  await (await caches.open(APP)).addAll(SHELL);
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== APP && k !== RT && k !== FONTS) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    if (u.pathname.startsWith('/api/')) return;
    if (/^\/rt\/(py|sql|cc)\//.test(u.pathname)) {
      e.respondWith(caches.open(RT).then(async c => (await c.match(u.pathname)) || fetch(e.request).then(r => { if (r.ok) c.put(u.pathname, r.clone()); return r; })));
      return;
    }
    e.respondWith(caches.open(APP).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true }) || (u.pathname === '/' ? await c.match('/index.html') : null);
      return hit || fetch(e.request);
    }));
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => new Response('', { status: 504 }))));
  }
});
