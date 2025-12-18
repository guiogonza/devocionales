const CACHE_NAME = 'devocionales-v34';
const AUDIO_CACHE_NAME = 'devocionales-audio-v2';

// Instalación del Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker: Instalado');
    self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker: Activado');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cache => cache !== CACHE_NAME && cache !== AUDIO_CACHE_NAME)
                    .map(cache => {
                        console.log('SW: Eliminando cache:', cache);
                        return caches.delete(cache);
                    })
            );
        }).then(() => {
            return self.clients.claim();
        }).then(async () => {
            // Forzar recarga de todas las apps abiertas
            const clientsList = await self.clients.matchAll({ type: 'window' });
            for (const client of clientsList) {
                client.navigate(client.url);
            }
        })
    );
});

// Estrategia de fetch
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar URLs que no sean http/https (chrome-extension, etc)
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Solo manejar solicitudes GET - POST, PUT, DELETE no se pueden cachear
    if (request.method !== 'GET') {
        return;
    }
    
    // NUNCA cachear respuestas de API - siempre ir a la red
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(request));
        return;
    }
    
    // NUNCA cachear logo.png, pastores.jpg, icon-192.png, icon-512.png - siempre ir a la red
    const noCacheImages = ['logo.png', 'pastores.jpg', 'icon-192.png', 'icon-512.png'];
    if (noCacheImages.some(img => url.pathname.includes(img))) {
        event.respondWith(fetch(request));
        return;
    }
    
    // Para archivos de audio, usar estrategia Cache First con Network Fallback
    if (url.pathname.startsWith('/audios/') || request.url.includes('.mp3')) {
        event.respondWith(handleAudioRequest(request));
        return;
    }
    
    // Para otros recursos, usar Network First con Cache Fallback
    event.respondWith(handleStaticRequest(request));
});

// Manejar solicitudes de audio
async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    
    // Intentar obtener del cache primero
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        console.log('Service Worker: Audio desde cache', request.url);
        return cachedResponse;
    }
    
    // Si no está en cache, obtener de la red y cachear
    try {
        const networkResponse = await fetch(request);
        
        // Solo cachear si la respuesta es exitosa
        if (networkResponse.ok) {
            // Clonar la respuesta antes de cachear
            const responseClone = networkResponse.clone();
            cache.put(request, responseClone);
            console.log('Service Worker: Audio cacheado', request.url);
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Error al obtener audio', error);
        // Retornar una respuesta de error
        return new Response('Audio no disponible', { status: 503 });
    }
}

// Manejar solicitudes estáticas
async function handleStaticRequest(request) {
    try {
        // Intentar obtener de la red primero
        const networkResponse = await fetch(request);
        
        // Cachear la respuesta exitosa
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Si falla la red, intentar desde cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('Service Worker: Sirviendo desde cache', request.url);
            return cachedResponse;
        }
        
        // Si es una navegación, retornar el index.html cacheado
        if (request.mode === 'navigate') {
            const indexCache = await caches.match('/index.html');
            if (indexCache) return indexCache;
        }
        
        console.error('Service Worker: Recurso no disponible', request.url);
        return new Response('Recurso no disponible offline', { status: 503 });
    }
}

// Manejar mensajes del cliente
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Pre-cachear audio específico
    if (event.data && event.data.type === 'CACHE_AUDIO') {
        const audioUrl = event.data.url;
        caches.open(AUDIO_CACHE_NAME).then(cache => {
            fetch(audioUrl).then(response => {
                if (response.ok) {
                    cache.put(audioUrl, response);
                }
            });
        });
    }
});

// Sincronización en segundo plano (cuando vuelve la conexión)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-audio') {
        console.log('Service Worker: Sincronizando audio');
        // Aquí se podría implementar lógica de sincronización
    }
});

// Notificaciones push (para futuras funcionalidades)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nuevo devocional disponible',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Spiritfly', options)
        );
    }
});

// Manejar click en notificación
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});
