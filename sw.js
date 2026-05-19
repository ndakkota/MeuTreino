self.addEventListener("install", event => {
  console.log("Service Worker instalado.");
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("Service Worker ativado.");
});

// Recebe push do servidor
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : { title: "PowerFit", body: "Você está há 2 dias sem treinar!" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "icon-192.png",
      badge: "icon-192.png"
    })
  );
});
