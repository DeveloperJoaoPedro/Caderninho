const CACHE='caderninho-offline-v1';
// Somente a página genérica sem conexão. Nunca guardar dados ou respostas da API.
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html')).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('caderninho-offline-')&&name!==CACHE).map(name=>caches.delete(name)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'&&new URL(event.request.url).origin===self.location.origin&&!new URL(event.request.url).pathname.startsWith('/api'))event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));});
