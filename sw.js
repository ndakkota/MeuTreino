const CACHE_NAME = 'powerfit-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192x192.png'
];

// Instalação do Cache (Adicionado skipWaiting)
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o SW novo a se tornar ativo imediatamente, sem esperar abas fecharem
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    // Garante que o Service Worker passe a controlar a página atual de imediato
    self.clients.claim() 
  );
});

// Estratégia Fetch (Network First com Fallback para Cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Ouvir evento de clique na Notificação do Celular
self.addEventListener('notificationclick', event => {
  event.notification.close(); // Fecha o popup
  
  // Abre o aplicativo ao clicar na notificação
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
