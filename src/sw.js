import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

precacheAndRoute(self.__WB_MANIFEST)

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let dados
  try {
    dados = event.data ? event.data.json() : {}
  } catch {
    dados = { titulo: 'Senac Lanches', mensagem: event.data ? event.data.text() : '' }
  }

  const titulo = dados.titulo || 'Senac Lanches'
  const opcoes = {
    body: dados.mensagem || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { url: dados.url || '/' },
    tag: dados.tag || 'senac-lanches',
  }

  event.waitUntil(self.registration.showNotification(titulo, opcoes))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
