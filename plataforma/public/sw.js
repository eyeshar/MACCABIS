// Service worker de Maccabis (D76): base de la web instalable. NO guarda nada en cache ni intercepta peticiones
// (sin manejador "fetch"): la web carga siempre de la red, igual que sin el. Los avisos (push) llegan en el paso 3.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));
