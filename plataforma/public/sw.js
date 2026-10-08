// Service worker de Maccabis (D76, D78, D99): base de la web instalable y AVISOS AL MOVIL. NO guarda nada en cache ni
// intercepta peticiones (sin manejador "fetch"): la web carga siempre de la red, igual que sin el. Solo anade "push"
// (enseñar el aviso, con el escudo) y "notificationclick" (abrir el evento o el domingo al tocarlo).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch { datos = { cuerpo: evento.data ? evento.data.text() : '' }; }
  const titulo = datos.titulo || 'Maccabis';
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: datos.cuerpo || '',
    icon: '/iconos/icono-192.png',
    badge: '/iconos/icono-192.png',
    tag: datos.tag || undefined,
    data: { url: datos.url || '/mi-zona' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || '/mi-zona', self.location.origin).href;
  evento.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (new URL(v.url).origin === self.location.origin && 'navigate' in v) {
        await v.focus();
        return v.navigate(destino);
      }
    }
    return self.clients.openWindow(destino);
  })());
});
